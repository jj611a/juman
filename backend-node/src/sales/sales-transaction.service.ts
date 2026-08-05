import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AvailabilityService } from '../availability/availability.service';
import {
  WALK_IN_CUSTOMER_NAME,
  WALK_IN_CUSTOMER_NUMBER,
  WALK_IN_CUSTOMER_PHONE,
} from '../customers/customers.constants';
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
import { SETTLEMENT_STATUS } from '../finance/settlement/settlement.constants';
import { SettlementService } from '../finance/settlement/settlement.service';
import { ITEM_LIFECYCLE } from '../inventory/inventory.constants';
import { LifecycleService } from '../inventory/lifecycle/lifecycle.service';
import { isSellable } from '../inventory/lifecycle/lifecycle.rules';
import { BusinessException } from '../shared/errors/business.exception';
import { normalizePhone } from '../shared/phone/phone';
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
  isLiveSaleSettlementStatus,
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
          where: { id: body.customerId, deletedAt: null, status: 'active' },
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
        await this.assertAndHoldItemForSale(tx, line.itemId, saleId, actor);
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
      if (!isLiveSaleSettlementStatus(settlement.status)) {
        throw BusinessException.conflict(
          `Cannot complete sale: settlement status «${settlement.status}» is not live`,
        );
      }

      for (const line of live.items) {
        const item = await tx.item.findFirst({
          where: { id: line.itemId, deletedAt: null },
        });
        if (!item) {
          throw BusinessException.notFound(`Item ${line.itemId} not found`);
        }
        await this.assertHoldOwnedBySale(tx, item.id, saleId);
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
        const paymentNumber = await this.finance.allocatePaymentNumberInTx(tx);
        await this.settlements.applyPaymentInTx(
          tx,
          settlement.id,
          {
            amountFils: body.paymentAmountFils,
            method: body.paymentMethod,
            notes: body.reason,
          },
          paymentNumber,
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
    idempotencyKey?: string,
  ): Promise<SalePublic> {
    const sale = await this.requireLive(saleId);
    if (sale.status === SALE_STATUS.CANCELLED) {
      const replay = await this.finance.peekIdempotencyReplay<SalePublic>(
        IDEMPOTENCY_SCOPE.SALE_CANCEL,
        idempotencyKey?.trim() || `sale:${saleId}:cancel`,
      );
      if (replay) return replay;
      return toSalePublic(sale);
    }
    if (!canCancel(sale.status)) {
      throw BusinessException.conflict(
        `Cannot cancel sale in status ${sale.status}`,
      );
    }

    const requestHash = hashIdempotencyPayload({
      saleId,
      reason: reason ?? null,
    });
    const idemKey = idempotencyKey?.trim() || `sale:${saleId}:cancel`;

    const result = await this.availability.runExclusive(async (tx) => {
      const began = await beginIdempotency<SalePublic>(tx, {
        scope: IDEMPOTENCY_SCOPE.SALE_CANCEL,
        key: idemKey,
        requestHash,
      });
      if (began.kind === 'replay') return began.response;

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
            const owned = await this.isHoldOwnedBySale(tx, item.id, saleId);
            if (!owned) continue;
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

      const pub = toSalePublic(updated);
      await completeIdempotency(tx, {
        scope: IDEMPOTENCY_SCOPE.SALE_CANCEL,
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

    const requestHash = hashIdempotencyPayload({
      saleId,
      amountFils: dto.amountFils,
      method: dto.method ?? 'cash',
      notes: dto.notes ?? null,
    });
    const idemKey =
      dto.idempotencyKey?.trim() || `sale:${saleId}:payment:${dto.amountFils}`;

    await this.availability.runExclusive(async (tx) => {
      const began = await beginIdempotency<{ ok: true }>(tx, {
        scope: IDEMPOTENCY_SCOPE.SALE_PAYMENT,
        key: idemKey,
        requestHash,
      });
      if (began.kind === 'replay') return began.response;

      const live = await this.repo.findByIdInTx(tx, saleId);
      if (!live || !canPay(live.status)) {
        throw BusinessException.conflict(
          `Cannot pay sale in status ${live?.status ?? 'missing'}`,
        );
      }
      const settlement = await this.settlements.findBySaleId(saleId, tx);
      if (!settlement) {
        throw BusinessException.conflict('Sale has no settlement — confirm first');
      }
      if (
        settlement.status === SETTLEMENT_STATUS.CANCELLED ||
        settlement.status === SETTLEMENT_STATUS.CLOSED
      ) {
        throw BusinessException.conflict(
          `Cannot pay cancelled/closed settlement`,
        );
      }

      const paymentNumber = await this.finance.allocatePaymentNumberInTx(tx);
      await this.settlements.applyPaymentInTx(
        tx,
        settlement.id,
        {
          amountFils: dto.amountFils,
          method: dto.method,
          notes: dto.notes,
        },
        paymentNumber,
        actor,
      );

      await completeIdempotency(tx, {
        scope: IDEMPOTENCY_SCOPE.SALE_PAYMENT,
        key: idemKey,
        resourceType: SALE_ENTITY,
        resourceId: saleId,
        response: { ok: true },
      });
      return { ok: true as const };
    });

    const updated = await this.requireLive(saleId);
    return toSalePublic(updated);
  }

  /**
   * Hold item for this sale only. Rejects foreign for_sale holds and concurrent confirmed sales.
   */
  private async assertAndHoldItemForSale(
    tx: Prisma.TransactionClient,
    itemId: string,
    saleId: string,
    actor?: AuthPrincipal,
  ): Promise<void> {
    const item = await tx.item.findFirst({
      where: { id: itemId, deletedAt: null },
    });
    if (!item) {
      throw BusinessException.notFound(`Item ${itemId} not found`);
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

    const otherConfirmed = await tx.saleItem.findFirst({
      where: {
        itemId,
        saleId: { not: saleId },
        sale: {
          deletedAt: null,
          status: { in: [SALE_STATUS.CONFIRMED, SALE_STATUS.COMPLETED] },
        },
      },
    });
    if (otherConfirmed) {
      throw BusinessException.conflict(
        `Item ${item.displayName} is already committed to another sale`,
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
      return;
    }

    // Only for_sale remains after isSellable; ownership checked here.
    await this.assertHoldOwnedBySale(tx, item.id, saleId);
  }

  private async assertHoldOwnedBySale(
    tx: Prisma.TransactionClient,
    itemId: string,
    saleId: string,
  ): Promise<void> {
    const owned = await this.isHoldOwnedBySale(tx, itemId, saleId);
    if (!owned) {
      throw BusinessException.conflict(
        'Item for_sale hold is owned by another sale',
      );
    }
  }

  private async isHoldOwnedBySale(
    tx: Prisma.TransactionClient,
    itemId: string,
    saleId: string,
  ): Promise<boolean> {
    const latest = await tx.itemStateHistory.findFirst({
      where: {
        itemId,
        newState: ITEM_LIFECYCLE.FOR_SALE,
      },
      orderBy: { createdAt: 'desc' },
    });
    return (
      latest?.referenceType === SALE_REFERENCE_TYPE &&
      latest?.referenceId === saleId
    );
  }

  private async reassignCustomerInTx(
    tx: Prisma.TransactionClient,
    sale: SaleWithRelations,
    customerId: string,
    actor?: AuthPrincipal,
  ) {
    const cust = await tx.customer.findFirst({
      where: { id: customerId, deletedAt: null, status: 'active' },
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

  /** Resolve Walk-in inside the exclusive TX (no nested connection). */
  private async resolveFinanceCustomerIdInTx(
    tx: Prisma.TransactionClient,
    saleCustomerId: string | null,
  ): Promise<string> {
    if (saleCustomerId) return saleCustomerId;
    const existing = await tx.customer.findUnique({
      where: { customerNumber: WALK_IN_CUSTOMER_NUMBER },
    });
    if (existing && !existing.deletedAt) return existing.id;
    if (existing?.deletedAt) {
      await tx.customer.update({
        where: { id: existing.id },
        data: { deletedAt: null, deletedBy: null, status: 'active' },
      });
      return existing.id;
    }
    const phone = normalizePhone(WALK_IN_CUSTOMER_PHONE);
    try {
      const created = await tx.customer.create({
        data: {
          customerNumber: WALK_IN_CUSTOMER_NUMBER,
          fullName: WALK_IN_CUSTOMER_NAME,
          phone: phone.display,
          phoneNormalized: phone.normalized,
          status: 'active',
          notes: 'System Walk-in customer for anonymous sales — do not delete',
        },
      });
      return created.id;
    } catch {
      const raced = await tx.customer.findUnique({
        where: { customerNumber: WALK_IN_CUSTOMER_NUMBER },
      });
      if (raced && !raced.deletedAt) return raced.id;
      throw BusinessException.conflict('Could not resolve Walk-in customer');
    }
  }

  private async requireLive(id: string): Promise<SaleWithRelations> {
    const row = await this.repo.findById(id);
    if (!row) throw BusinessException.notFound('Sale not found');
    return row;
  }
}
