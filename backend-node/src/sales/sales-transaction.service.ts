import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AvailabilityService } from '../availability/availability.service';
import { CustomersService } from '../customers/customers.service';
import {
  FINANCIAL_TX_TYPE,
  FINANCE_REFERENCE_SALE,
  SETTLEMENT_ENTITY_TYPE,
} from '../finance/finance.constants';
import { FinanceService } from '../finance/finance.service';
import {
  beginIdempotency,
  completeIdempotency,
  hashIdempotencyPayload,
  IDEMPOTENCY_SCOPE,
} from '../finance/idempotency/idempotency';
import { SettlementService } from '../finance/settlement/settlement.service';
import { ITEM_LIFECYCLE } from '../inventory/inventory.constants';
import { LifecycleService } from '../inventory/lifecycle/lifecycle.service';
import { isSellable } from '../inventory/lifecycle/lifecycle.rules';
import { BusinessException } from '../shared/errors/business.exception';
import type { AuthPrincipal } from '../shared/types';
import type { SaleActionDto, SaleCompleteDto, SalePaymentDto } from './dto/sale.dto';
import {
  SALE_ENTITY,
  SALE_HISTORY_ACTION,
  SALE_MODULE,
  SALE_REFERENCE_TYPE,
  SALE_STATUS,
  type SaleStatus,
} from './sales.constants';
import { toSalePublic, toSaleSnapshot, type SalePublic } from './sales.mapper';
import { SalesRepository, type SaleWithRelations } from './sales.repository';
import {
  canCancel,
  canComplete,
  canConfirm,
  canPay,
  canTransitionSaleStatus,
} from './sales.rules';

/**
 * Exclusive-TX orchestration for Sales.
 * SalesService must not call Lifecycle / Settlement / Finance write APIs directly.
 */
@Injectable()
export class SalesTransactionService {
  constructor(
    private readonly repo: SalesRepository,
    private readonly availability: AvailabilityService,
    private readonly lifecycle: LifecycleService,
    private readonly settlements: SettlementService,
    private readonly finance: FinanceService,
    private readonly customers: CustomersService,
    private readonly audit: AuditService,
  ) {}

  async resolveFinanceCustomerId(
    saleCustomerId: string | null | undefined,
  ): Promise<string> {
    if (saleCustomerId) return saleCustomerId;
    const walkIn = await this.customers.ensureWalkInCustomer();
    return walkIn.id;
  }

  async confirm(
    saleId: string,
    body: SaleActionDto | undefined,
    actor?: AuthPrincipal,
  ): Promise<SalePublic> {
    const sale = await this.requireLive(saleId);
    if (sale.status === SALE_STATUS.CONFIRMED || sale.status === SALE_STATUS.COMPLETED) {
      const replay = await this.finance.peekIdempotencyReplay<SalePublic>(
        IDEMPOTENCY_SCOPE.SALE_CONFIRM,
        body?.idempotencyKey?.trim() || `sale:${saleId}:confirm`,
      );
      if (replay) return replay;
      return toSalePublic(sale);
    }
    if (!canConfirm(sale.status)) {
      throw BusinessException.conflict(
        `Cannot confirm sale in status ${sale.status}`,
      );
    }
    if (!canTransitionSaleStatus(sale.status as SaleStatus, SALE_STATUS.CONFIRMED)) {
      throw BusinessException.conflict('Invalid sale transition to confirmed');
    }

    const requestHash = hashIdempotencyPayload({
      saleId,
      customerId: body?.customerId ?? sale.customerId,
      reason: body?.reason ?? null,
    });
    const idemKey =
      body?.idempotencyKey?.trim() || `sale:${saleId}:confirm`;

    const result = await this.availability.runExclusive(async (tx) => {
      const began = await beginIdempotency<SalePublic>(tx, {
        scope: IDEMPOTENCY_SCOPE.SALE_CONFIRM,
        key: idemKey,
        requestHash,
      });
      if (began.kind === 'replay') return began.response;

      const live = await this.repo.findByIdInTx(tx, saleId);
      if (!live) throw BusinessException.notFound('Sale not found');
      if (live.status !== SALE_STATUS.DRAFT) {
        throw BusinessException.conflict(
          `Cannot confirm sale in status ${live.status}`,
        );
      }

      if (body?.customerId) {
        const cust = await tx.customer.findFirst({
          where: { id: body.customerId, deletedAt: null },
        });
        if (!cust) throw BusinessException.notFound('Customer not found');
        await this.repo.updateCustomerInTx(
          tx,
          saleId,
          body.customerId,
          actor?.userId,
        );
        live.customerId = body.customerId;
      }

      for (const line of live.items) {
        const item = await tx.item.findFirst({
          where: { id: line.itemId, deletedAt: null },
        });
        if (!item) {
          throw BusinessException.notFound(`Item ${line.itemId} not found`);
        }
        if (
          !isSellable({
            deletedAt: item.deletedAt,
            status: item.status,
            lifecycleState: item.lifecycleState,
          })
        ) {
          throw BusinessException.conflict(
            `Item ${item.displayName} is not sellable (lifecycle: ${item.lifecycleState})`,
          );
        }
        if (item.lifecycleState === ITEM_LIFECYCLE.AVAILABLE) {
          await this.lifecycle.transition(
            item.id,
            {
              newState: ITEM_LIFECYCLE.FOR_SALE,
              expectedState: ITEM_LIFECYCLE.AVAILABLE,
              reason: 'sale_confirm_hold',
              referenceType: SALE_REFERENCE_TYPE,
              referenceId: saleId,
            },
            actor,
            { tx, skipAudit: true },
          );
        } else if (item.lifecycleState !== ITEM_LIFECYCLE.FOR_SALE) {
          throw BusinessException.conflict(
            `Item ${item.displayName} cannot be held for sale`,
          );
        }
      }

      const financeCustomerId = await this.resolveFinanceCustomerIdInTx(
        tx,
        live.customerId,
      );

      const settlement = await this.settlements.createForEntityInTx(
        tx,
        {
          entityType: SETTLEMENT_ENTITY_TYPE.SALE,
          entityId: saleId,
          customerId: financeCustomerId,
          chargeFils: live.totalFils,
          depositFils: 0,
        },
        actor,
      );

      if (live.totalFils > 0) {
        await this.finance.createChargeInTx(
          tx,
          {
            customerId: financeCustomerId,
            amountFils: live.totalFils,
            referenceType: FINANCE_REFERENCE_SALE,
            referenceId: saleId,
            settlementId: settlement.id,
            description: `رسوم بيع ${live.saleNumber}`,
            chargeType: FINANCIAL_TX_TYPE.SALE_CHARGE,
          },
          actor,
        );
      }

      const updated = await this.repo.transitionStatus(tx, {
        saleId,
        from: SALE_STATUS.DRAFT,
        to: SALE_STATUS.CONFIRMED,
        action: SALE_HISTORY_ACTION.CONFIRMED,
        reason: body?.reason?.trim() || 'confirmed',
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
      });
      if (!updated) {
        throw BusinessException.conflict('Concurrent sale confirm rejected');
      }

      const pub = toSalePublic(updated);
      await completeIdempotency(tx, {
        scope: IDEMPOTENCY_SCOPE.SALE_CONFIRM,
        key: idemKey,
        resourceType: SALE_ENTITY,
        resourceId: saleId,
        response: pub,
      });
      return pub;
    });

    await this.audit.record({
      module: SALE_MODULE,
      entityType: SALE_ENTITY,
      entityId: saleId,
      action: SALE_HISTORY_ACTION.CONFIRMED,
      oldValues: toSaleSnapshot(sale),
      newValues: toSaleSnapshot(result),
      actor: { userId: actor?.userId, username: actor?.username },
    });

    return result;
  }

  async complete(
    saleId: string,
    body: SaleCompleteDto | undefined,
    actor?: AuthPrincipal,
  ): Promise<SalePublic> {
    const sale = await this.requireLive(saleId);
    if (sale.status === SALE_STATUS.COMPLETED) {
      const replay = await this.finance.peekIdempotencyReplay<SalePublic>(
        IDEMPOTENCY_SCOPE.SALE_COMPLETE,
        body?.idempotencyKey?.trim() || `sale:${saleId}:complete`,
      );
      if (replay) return replay;
      return toSalePublic(sale);
    }
    if (!canComplete(sale.status)) {
      throw BusinessException.conflict(
        `Cannot complete sale in status ${sale.status}`,
      );
    }

    const requestHash = hashIdempotencyPayload({
      saleId,
      paymentAmountFils: body?.paymentAmountFils ?? null,
      customerId: body?.customerId ?? sale.customerId,
    });
    const idemKey =
      body?.idempotencyKey?.trim() || `sale:${saleId}:complete`;

    const result = await this.availability.runExclusive(async (tx) => {
      const began = await beginIdempotency<SalePublic>(tx, {
        scope: IDEMPOTENCY_SCOPE.SALE_COMPLETE,
        key: idemKey,
        requestHash,
      });
      if (began.kind === 'replay') return began.response;

      const live = await this.repo.findByIdInTx(tx, saleId);
      if (!live) throw BusinessException.notFound('Sale not found');
      if (live.status !== SALE_STATUS.CONFIRMED) {
        throw BusinessException.conflict(
          `Cannot complete sale in status ${live.status}`,
        );
      }

      if (body?.customerId && body.customerId !== live.customerId) {
        await this.reassignCustomerInTx(tx, live, body.customerId, actor);
      }

      const settlement = await this.settlements.findBySaleId(saleId, tx);
      if (!settlement) {
        throw BusinessException.conflict('Sale has no settlement — confirm first');
      }

      for (const line of live.items) {
        const item = await tx.item.findFirst({
          where: { id: line.itemId, deletedAt: null },
        });
        if (!item) {
          throw BusinessException.notFound(`Item ${line.itemId} not found`);
        }
        if (item.lifecycleState !== ITEM_LIFECYCLE.FOR_SALE) {
          throw BusinessException.conflict(
            `Item ${item.displayName} must be for_sale before complete (got ${item.lifecycleState})`,
          );
        }
        await this.lifecycle.transition(
          item.id,
          {
            newState: ITEM_LIFECYCLE.SOLD,
            expectedState: ITEM_LIFECYCLE.FOR_SALE,
            reason: 'sale_complete',
            referenceType: SALE_REFERENCE_TYPE,
            referenceId: saleId,
          },
          actor,
          { tx, skipAudit: true },
        );
      }

      if (body?.paymentAmountFils && body.paymentAmountFils > 0) {
        await this.applyPaymentInTx(
          tx,
          settlement.id,
          {
            amountFils: body.paymentAmountFils,
            method: body.paymentMethod,
            notes: body.reason,
          },
          actor,
        );
      }

      const updated = await this.repo.transitionStatus(tx, {
        saleId,
        from: SALE_STATUS.CONFIRMED,
        to: SALE_STATUS.COMPLETED,
        action: SALE_HISTORY_ACTION.COMPLETED,
        reason: body?.reason?.trim() || 'completed',
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
        extra: { completedAt: new Date() },
      });
      if (!updated) {
        throw BusinessException.conflict('Concurrent sale complete rejected');
      }

      const pub = toSalePublic(updated);
      await completeIdempotency(tx, {
        scope: IDEMPOTENCY_SCOPE.SALE_COMPLETE,
        key: idemKey,
        resourceType: SALE_ENTITY,
        resourceId: saleId,
        response: pub,
      });
      return pub;
    });

    await this.audit.record({
      module: SALE_MODULE,
      entityType: SALE_ENTITY,
      entityId: saleId,
      action: SALE_HISTORY_ACTION.COMPLETED,
      oldValues: toSaleSnapshot(sale),
      newValues: toSaleSnapshot(result),
      actor: { userId: actor?.userId, username: actor?.username },
    });

    return result;
  }

  async cancel(
    saleId: string,
    reason?: string,
    actor?: AuthPrincipal,
  ): Promise<SalePublic> {
    const sale = await this.requireLive(saleId);
    if (!canCancel(sale.status)) {
      throw BusinessException.conflict(
        `Cannot cancel sale in status ${sale.status}`,
      );
    }

    const result = await this.availability.runExclusive(async (tx) => {
      const live = await this.repo.findByIdInTx(tx, saleId);
      if (!live) throw BusinessException.notFound('Sale not found');
      if (!canCancel(live.status)) {
        throw BusinessException.conflict(
          `Cannot cancel sale in status ${live.status}`,
        );
      }

      if (live.status === SALE_STATUS.CONFIRMED) {
        await this.settlements.applySaleCancelPolicyInTx(
          tx,
          saleId,
          reason,
          actor,
        );

        for (const line of live.items) {
          const item = await tx.item.findFirst({
            where: { id: line.itemId, deletedAt: null },
          });
          if (!item) continue;
          if (item.lifecycleState === ITEM_LIFECYCLE.FOR_SALE) {
            await this.lifecycle.transition(
              item.id,
              {
                newState: ITEM_LIFECYCLE.AVAILABLE,
                expectedState: ITEM_LIFECYCLE.FOR_SALE,
                reason: 'sale_cancelled',
                referenceType: SALE_REFERENCE_TYPE,
                referenceId: saleId,
              },
              actor,
              { tx, skipAudit: true },
            );
          }
        }
      }

      const updated = await this.repo.transitionStatus(tx, {
        saleId,
        from: live.status,
        to: SALE_STATUS.CANCELLED,
        action: SALE_HISTORY_ACTION.CANCELLED,
        reason: reason?.trim() || 'cancelled',
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
      });
      if (!updated) {
        throw BusinessException.conflict('Concurrent sale cancel rejected');
      }
      return toSalePublic(updated);
    });

    await this.audit.record({
      module: SALE_MODULE,
      entityType: SALE_ENTITY,
      entityId: saleId,
      action: SALE_HISTORY_ACTION.CANCELLED,
      oldValues: toSaleSnapshot(sale),
      newValues: toSaleSnapshot(result),
      actor: { userId: actor?.userId, username: actor?.username },
    });

    return result;
  }

  async payment(
    saleId: string,
    dto: SalePaymentDto,
    actor?: AuthPrincipal,
  ): Promise<SalePublic> {
    const sale = await this.requireLive(saleId);
    if (!canPay(sale.status)) {
      throw BusinessException.conflict(
        `Cannot pay sale in status ${sale.status}`,
      );
    }
    const settlement = await this.settlements.findBySaleId(saleId);
    if (!settlement) {
      throw BusinessException.conflict('Sale has no settlement — confirm first');
    }

    await this.settlements.applyPayment(
      settlement.id,
      {
        amountFils: dto.amountFils,
        method: dto.method,
        notes: dto.notes,
        idempotencyKey: dto.idempotencyKey,
      },
      actor,
    );

    const updated = await this.requireLive(saleId);
    return toSalePublic(updated);
  }

  private async applyPaymentInTx(
    tx: Prisma.TransactionClient,
    settlementId: string,
    dto: { amountFils: number; method?: string; notes?: string },
    actor?: AuthPrincipal,
  ) {
    // SettlementService.applyPayment opens its own TX — for nested complete we
    // call finance + CAS directly mirroring applyPayment body.
    const live = await tx.rentalSettlement.findFirst({
      where: { id: settlementId, deletedAt: null },
    });
    if (!live) throw BusinessException.notFound('Settlement not found');
    if (dto.amountFils > live.remainingFils) {
      throw BusinessException.validation(
        'Payment exceeds settlement remaining balance',
      );
    }
    const paymentNumber = await this.finance.allocatePaymentNumberInTx(tx);
    const payment = await this.finance.registerPaymentInTx(
      tx,
      {
        accountId: live.accountId,
        settlementId: live.id,
        amountFils: dto.amountFils,
        method: dto.method,
        notes: dto.notes,
      },
      paymentNumber,
      actor,
      {
        ledgerType:
          live.entityType === SETTLEMENT_ENTITY_TYPE.SALE
            ? FINANCIAL_TX_TYPE.SALE_PAYMENT
            : FINANCIAL_TX_TYPE.PAYMENT,
      },
    );
    const newPaid = live.paidFils + dto.amountFils;
    const newRemaining = live.remainingFils - dto.amountFils;
    const newStatus =
      newRemaining === 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : live.status;
    const updated = await this.settlements.settlementRepo.applyPaymentCas(tx, {
      settlementId: live.id,
      expectedRemaining: live.remainingFils,
      fromStatus: live.status,
      amountFils: dto.amountFils,
      newPaid,
      newRemaining,
      newStatus,
      paymentId: payment.id,
      userId: actor?.userId ?? null,
      username: actor?.username ?? null,
    });
    if (!updated) {
      throw BusinessException.conflict('Concurrent settlement payment rejected');
    }
  }

  private async reassignCustomerInTx(
    tx: Prisma.TransactionClient,
    sale: SaleWithRelations,
    customerId: string,
    actor?: AuthPrincipal,
  ) {
    const cust = await tx.customer.findFirst({
      where: { id: customerId, deletedAt: null },
    });
    if (!cust) throw BusinessException.notFound('Customer not found');
    await this.repo.updateCustomerInTx(tx, sale.id, customerId, actor?.userId);
    const settlement = await this.settlements.findBySaleId(sale.id, tx);
    if (settlement) {
      await this.settlements.reassignCustomerInTx(
        tx,
        settlement.id,
        customerId,
        actor,
      );
    }
  }

  private async resolveFinanceCustomerIdInTx(
    tx: Prisma.TransactionClient,
    saleCustomerId: string | null,
  ): Promise<string> {
    if (saleCustomerId) return saleCustomerId;
    // ensureWalkIn outside may race; upsert by number inside TX
    const existing = await tx.customer.findUnique({
      where: { customerNumber: 'WALK-IN' },
    });
    if (existing && !existing.deletedAt) return existing.id;
    const walkIn = await this.customers.ensureWalkInCustomer();
    return walkIn.id;
  }

  private async requireLive(id: string): Promise<SaleWithRelations> {
    const row = await this.repo.findById(id);
    if (!row) throw BusinessException.notFound('Sale not found');
    return row;
  }
}
