import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { AvailabilityService } from '../availability/availability.service';
import { BarcodeService } from '../barcode/barcode.service';
import { CustomersService } from '../customers/customers.service';
import { CUSTOMER_STATUS } from '../customers/customers.constants';
import { FinanceService } from '../finance/finance.service';
import { FINANCE_REFERENCE_RENTAL } from '../finance/finance.constants';
import {
  beginIdempotency,
  completeIdempotency,
  hashIdempotencyPayload,
  IDEMPOTENCY_SCOPE,
} from '../finance/idempotency/idempotency';
import { SettlementService } from '../finance/settlement/settlement.service';
import { assertLedgerMatchesSettlement } from '../finance/settlement/settlement.integrity';
import { ItemsService } from '../inventory/items/items.service';
import { ITEM_LIFECYCLE, ITEM_STATUS } from '../inventory/inventory.constants';
import { LifecycleService } from '../inventory/lifecycle/lifecycle.service';
import { isRentable } from '../inventory/lifecycle/lifecycle.rules';
import { SettingsService } from '../settings/settings.service';
import { AUDIT_ACTION, BARCODE_STATUS } from '../shared/constants/business.constants';
import { BusinessException } from '../shared/errors/business.exception';
import {
  normalizePagination,
  paginated,
} from '../shared/pagination/pagination';
import { normalizeSearchQuery } from '../shared/search/search';
import { normalizeSort } from '../shared/sorting/sorting';
import { parseOptionalBoolean } from '../shared/validation/parse-boolean';
import type { AuthPrincipal } from '../shared/types';
import type {
  CreateRentalDto,
  CreateRentalItemDto,
  ListRentalsDto,
  UpdateRentalDto,
} from './dto/rental.dto';
import { toRentalPublic } from './rentals.mapper';
import {
  RENTAL_CANCEL_ITEM_PATH,
  RENTAL_DEFAULT_PADDING,
  RENTAL_DEFAULT_PREFIX,
  RENTAL_DEFAULT_SEPARATOR,
  RENTAL_ENTITY,
  RENTAL_MODULE,
  RENTAL_NUMBER_SETTING,
  RENTAL_REFERENCE_TYPE,
  RENTAL_SORT_FIELDS,
  RENTAL_STATUS,
  type RentalStatus,
} from './rentals.constants';
import {
  canCancel,
  canCheckout,
  canComplete,
  canInitiateReturn,
  canTransitionRentalStatus,
  isRentalStatus,
} from './rentals.rules';
import {
  RentalsRepository,
  type RentalWithRelations,
} from './rentals.repository';

@Injectable()
export class RentalsService {
  constructor(
    private readonly repo: RentalsRepository,
    private readonly customers: CustomersService,
    private readonly items: ItemsService,
    private readonly lifecycle: LifecycleService,
    private readonly barcodes: BarcodeService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly availability: AvailabilityService,
    private readonly finance: FinanceService,
    private readonly settlements: SettlementService,
  ) {}

  async create(dto: CreateRentalDto, actor?: AuthPrincipal) {
    await this.requireActiveCustomer(dto.customerId);
    const rentalDate = this.parseDate(dto.rentalDate, 'rentalDate');
    const expectedReturnDate = this.parseDate(
      dto.expectedReturnDate,
      'expectedReturnDate',
    );
    if (expectedReturnDate.getTime() < rentalDate.getTime()) {
      throw BusinessException.validation(
        'expectedReturnDate must be on or after rentalDate',
      );
    }

    const prepared = await this.prepareItems(dto.items);
    const rentalNumber = await this.allocateNumber();

    const row = await this.availability.runExclusive(async (tx) => {
      await this.availability.assertItemsAvailable(
        prepared.map((p) => p.itemId),
        rentalDate,
        expectedReturnDate,
        { tx },
      );
      return this.repo.createInTx(
        tx,
        {
          rentalNumber,
          customerId: dto.customerId,
          rentalDate,
          expectedReturnDate,
          status: RENTAL_STATUS.DRAFT,
          notes: dto.notes?.trim() || null,
          createdBy: actor?.userId ?? null,
          updatedBy: actor?.userId ?? null,
        },
        prepared.map((p) => ({
          itemId: p.itemId,
          barcodeValue: p.barcodeValue,
          agreedRentalPrice: p.agreedRentalPrice,
          notes: p.notes,
          createdBy: actor?.userId ?? null,
        })),
        { userId: actor?.userId, username: actor?.username },
      );
    });

    await this.audit.recordCreate(
      RENTAL_MODULE,
      RENTAL_ENTITY,
      row.id,
      this.snapshot(row),
      { userId: actor?.userId, username: actor?.username },
    );

    return toRentalPublic(row);
  }

  async list(query: ListRentalsDto) {
    const page = normalizePagination(query);
    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      new Set(RENTAL_SORT_FIELDS),
      { field: 'createdAt', direction: 'desc' },
    );
    const { rows, total } = await this.repo.list({
      where: this.where(query),
      orderBy: { [sort.field]: sort.direction },
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(rows.map(toRentalPublic), total, page);
  }

  async getById(id: string) {
    return toRentalPublic(await this.requireLive(id));
  }

  async update(id: string, dto: UpdateRentalDto, actor?: AuthPrincipal) {
    const existing = await this.requireLive(id);
    if (dto.notes === undefined) {
      return toRentalPublic(existing);
    }
    const notes =
      dto.notes == null ? null : dto.notes.trim() || null;
    if (notes !== null && notes.length > 2000) {
      throw BusinessException.validation('notes must be at most 2000 characters');
    }
    const updated = await this.repo.updateNotes(
      id,
      notes,
      actor?.userId ?? null,
    );
    await this.audit.recordUpdate(
      RENTAL_MODULE,
      RENTAL_ENTITY,
      id,
      this.snapshot(existing),
      this.snapshot(updated),
      { userId: actor?.userId, username: actor?.username },
    );
    return toRentalPublic(updated);
  }

  async listAudit(
    id: string,
    page?: { offset?: number; limit?: number },
  ) {
    await this.requireLive(id);
    const result = await this.audit.list({
      module: RENTAL_MODULE,
      entityType: RENTAL_ENTITY,
      entityId: id,
      offset: page?.offset,
      limit: page?.limit ?? 50,
    });
    return paginated(
      result.items.map((row) => ({
        id: row.id,
        module: row.module,
        entityType: row.entityType,
        entityId: row.entityId,
        action: row.action,
        oldValues: this.parseJson(row.oldValues),
        newValues: this.parseJson(row.newValues),
        userId: row.userId,
        username: row.username,
        ipAddress: row.ipAddress,
        metadata: this.parseJson(row.metadata),
        message: row.message,
        createdAt: row.createdAt,
      })),
      result.meta.total,
      { offset: result.meta.offset, limit: result.meta.limit },
    );
  }

  /**
   * Checkout: draft → checked_out → active, inventory available → reserved → rented,
   * settlement + charge + deposit — ONE Prisma transaction. Failure rolls back all.
   */
  async checkout(
    id: string,
    reason?: string,
    actor?: AuthPrincipal,
    depositAmountFils?: number,
    idempotencyKey?: string,
  ) {
    const rental = await this.requireLive(id);
    const deposit = depositAmountFils ?? 0;
    const idemKey =
      idempotencyKey?.trim() || `rental:${id}:checkout`;
    const requestHash = hashIdempotencyPayload({
      rentalId: id,
      depositAmountFils: deposit,
    });

    if (!canCheckout(rental.status)) {
      const replay = await this.finance.peekIdempotencyReplay<
        ReturnType<typeof toRentalPublic>
      >(IDEMPOTENCY_SCOPE.RENTAL_CHECKOUT, idemKey);
      if (replay) return replay;
      throw BusinessException.conflict(
        `Cannot checkout rental in status ${rental.status}`,
      );
    }
    await this.requireActiveCustomer(rental.customerId);

    for (const line of rental.items) {
      await this.assertItemRentable(line.itemId, line.barcodeValue);
    }

    const ref = {
      referenceType: RENTAL_REFERENCE_TYPE,
      referenceId: rental.id,
    };

    const result = await this.availability.runExclusive(async (tx) => {
      const began = await beginIdempotency<ReturnType<typeof toRentalPublic>>(
        tx,
        {
          scope: IDEMPOTENCY_SCOPE.RENTAL_CHECKOUT,
          key: idemKey,
          requestHash,
        },
      );
      if (began.kind === 'replay') return began.response;

      await this.availability.assertItemsAvailable(
        rental.items.map((i) => i.itemId),
        rental.rentalDate,
        rental.expectedReturnDate,
        { excludeRentalId: rental.id, tx },
      );

      for (const line of rental.items) {
        await this.lifecycle.transition(
          line.itemId,
          {
            newState: ITEM_LIFECYCLE.RESERVED,
            expectedState: ITEM_LIFECYCLE.AVAILABLE,
            reason: reason?.trim() || 'rental_checkout',
            ...ref,
          },
          actor,
          { tx, skipAudit: true },
        );
        await this.lifecycle.transition(
          line.itemId,
          {
            newState: ITEM_LIFECYCLE.RENTED,
            expectedState: ITEM_LIFECYCLE.RESERVED,
            reason: reason?.trim() || 'rental_checkout',
            ...ref,
          },
          actor,
          { tx, skipAudit: true },
        );
      }

      const afterCheckout = await this.repo.transitionStatus({
        rentalId: rental.id,
        from: RENTAL_STATUS.DRAFT,
        to: RENTAL_STATUS.CHECKED_OUT,
        reason: reason?.trim() || 'checkout',
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
        tx,
      });
      if (!afterCheckout) {
        throw BusinessException.conflict(
          'Concurrent rental checkout rejected',
        );
      }

      const afterActive = await this.repo.transitionStatus({
        rentalId: rental.id,
        from: RENTAL_STATUS.CHECKED_OUT,
        to: RENTAL_STATUS.ACTIVE,
        reason: 'handover_complete',
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
        tx,
      });
      if (!afterActive) {
        throw BusinessException.conflict(
          'Concurrent rental activation rejected',
        );
      }

      await this.syncCheckoutFinanceInTx(tx, rental.id, deposit, actor);

      const pub = toRentalPublic(afterActive);
      await completeIdempotency(tx, {
        scope: IDEMPOTENCY_SCOPE.RENTAL_CHECKOUT,
        key: idemKey,
        resourceType: RENTAL_ENTITY,
        resourceId: rental.id,
        response: pub,
      });
      return pub;
    });

    for (const line of rental.items) {
      await this.audit.record({
        module: RENTAL_MODULE,
        entityType: RENTAL_ENTITY,
        entityId: rental.id,
        action: AUDIT_ACTION.TRANSITION,
        newValues: {
          itemId: line.itemId,
          inventoryPath: 'available→reserved→rented',
        },
        message: 'checkout_inventory',
        actor: { userId: actor?.userId, username: actor?.username },
      });
    }

    await this.audit.record({
      module: RENTAL_MODULE,
      entityType: RENTAL_ENTITY,
      entityId: id,
      action: 'checkout',
      oldValues: this.snapshot(rental),
      newValues: this.snapshot(await this.requireLive(id)),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return result;
  }

  /**
   * Finance slice of checkout — must run inside the same outer TX as inventory/rental.
   * Order: settlement → charge → deposit (all reference settlementId).
   */
  async syncCheckoutFinanceInTx(
    tx: Prisma.TransactionClient,
    rentalId: string,
    depositAmountFils: number,
    actor?: AuthPrincipal,
  ) {
    const rental = await tx.rental.findFirst({
      where: { id: rentalId, deletedAt: null },
      include: { items: true },
    });
    if (!rental) throw BusinessException.notFound('Rental not found');

    const chargeFils = rental.items.reduce(
      (sum, line) => sum + (line.agreedRentalPrice ?? 0),
      0,
    );
    const deposit = depositAmountFils ?? 0;

    const settlement = await this.settlements.createForRentalInTx(
      tx,
      {
        rentalId: rental.id,
        customerId: rental.customerId,
        chargeFils,
        depositFils: deposit,
      },
      actor,
    );

    if (chargeFils > 0) {
      await this.finance.createChargeInTx(
        tx,
        {
          customerId: rental.customerId,
          amountFils: chargeFils,
          referenceType: FINANCE_REFERENCE_RENTAL,
          referenceId: rental.id,
          settlementId: settlement.id,
          description: `رسوم إيجار ${rental.rentalNumber}`,
        },
        actor,
      );
    }
    if (deposit > 0) {
      await this.finance.registerDepositInTx(
        tx,
        {
          customerId: rental.customerId,
          amountFils: deposit,
          referenceType: FINANCE_REFERENCE_RENTAL,
          referenceId: rental.id,
          settlementId: settlement.id,
          description: `دفعة أولية ${rental.rentalNumber}`,
        },
        actor,
      );
    }

    assertLedgerMatchesSettlement({
      chargeFils,
      depositFils: deposit,
      settlementTotalFils: settlement.totalFils,
      settlementPaidFils: settlement.paidFils,
      settlementRemainingFils: settlement.remainingFils,
      appliedPaymentFils: settlement.paidFils,
    });
  }

  /**
   * @deprecated Prefer syncCheckoutFinanceInTx inside checkout exclusive TX.
   * Kept for reservation path migration — delegates to exclusive TX.
   */
  async syncCheckoutFinance(
    rentalId: string,
    depositAmountFils?: number,
    actor?: AuthPrincipal,
  ) {
    await this.availability.runExclusive(async (tx) => {
      await this.syncCheckoutFinanceInTx(
        tx,
        rentalId,
        depositAmountFils ?? 0,
        actor,
      );
    });
  }

  /** Foundation return: outbound → return_pending; inventory rented → return_pending. */
  async initiateReturn(id: string, reason?: string, actor?: AuthPrincipal) {
    const rental = await this.requireLive(id);
    if (!canInitiateReturn(rental.status)) {
      throw BusinessException.conflict(
        `Cannot initiate return from status ${rental.status}`,
      );
    }
    const from = rental.status as RentalStatus;
    if (!canTransitionRentalStatus(from, RENTAL_STATUS.RETURN_PENDING)) {
      throw BusinessException.conflict(
        `Invalid rental transition: ${from} → ${RENTAL_STATUS.RETURN_PENDING}`,
      );
    }

    await this.repo.client.$transaction(async (tx) => {
      for (const line of rental.items) {
        await this.lifecycle.transition(
          line.itemId,
          {
            newState: ITEM_LIFECYCLE.RETURN_PENDING,
            expectedState: ITEM_LIFECYCLE.RENTED,
            reason: reason?.trim() || 'rental_return',
            referenceType: RENTAL_REFERENCE_TYPE,
            referenceId: rental.id,
          },
          actor,
          { tx, skipAudit: true },
        );
      }

      const updated = await this.repo.transitionStatus({
        rentalId: rental.id,
        from,
        to: RENTAL_STATUS.RETURN_PENDING,
        reason: reason?.trim() || 'return',
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
        extra: { actualReturnDate: new Date() },
        tx,
      });
      if (!updated) {
        throw BusinessException.conflict('Concurrent rental return rejected');
      }
    });

    const updated = await this.requireLive(id);
    await this.audit.record({
      module: RENTAL_MODULE,
      entityType: RENTAL_ENTITY,
      entityId: id,
      action: 'return_pending',
      oldValues: this.snapshot(rental),
      newValues: this.snapshot(updated),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return toRentalPublic(updated);
  }

  /**
   * Close rental (return_pending → completed).
   * Financial completion is decided only by SettlementService.
   */
  async complete(id: string, reason?: string, actor?: AuthPrincipal) {
    const rental = await this.requireLive(id);
    if (!canComplete(rental.status)) {
      throw BusinessException.conflict(
        `Cannot complete rental in status ${rental.status}`,
      );
    }
    await this.settlements.assertFinanciallyComplete(rental.id);

    const updated = await this.repo.transitionStatus({
      rentalId: rental.id,
      from: RENTAL_STATUS.RETURN_PENDING,
      to: RENTAL_STATUS.COMPLETED,
      reason: reason?.trim() || 'completed',
      userId: actor?.userId ?? null,
      username: actor?.username ?? null,
    });
    if (!updated) {
      throw BusinessException.conflict('Concurrent rental complete rejected');
    }

    await this.audit.record({
      module: RENTAL_MODULE,
      entityType: RENTAL_ENTITY,
      entityId: id,
      action: 'complete',
      oldValues: this.snapshot(rental),
      newValues: this.snapshot(updated),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return toRentalPublic(updated);
  }

  /**
   * Materialize an active rental from a confirmed reservation inside an outer TX.
   * Inventory transitions go through LifecycleService only.
   */
  async materializeActiveFromReservation(
    input: {
      reservationId: string;
      customerId: string;
      rentalDate: Date;
      expectedReturnDate: Date;
      notes?: string | null;
      items: Array<{
        itemId: string;
        barcodeValue?: string | null;
        agreedRentalPrice: number;
        notes?: string | null;
      }>;
      reason?: string | null;
    },
    tx: Prisma.TransactionClient,
    actor?: AuthPrincipal,
  ): Promise<RentalWithRelations> {
    const rentalNumber = await this.allocateNumberInTx(tx);
    const draft = await this.repo.createInTx(
      tx,
      {
        rentalNumber,
        customerId: input.customerId,
        reservationId: input.reservationId,
        rentalDate: input.rentalDate,
        expectedReturnDate: input.expectedReturnDate,
        status: RENTAL_STATUS.DRAFT,
        notes: input.notes ?? null,
        createdBy: actor?.userId ?? null,
        updatedBy: actor?.userId ?? null,
      },
      input.items.map((i) => ({
        itemId: i.itemId,
        barcodeValue: i.barcodeValue ?? null,
        agreedRentalPrice: i.agreedRentalPrice,
        notes: i.notes ?? null,
        createdBy: actor?.userId ?? null,
      })),
      { userId: actor?.userId, username: actor?.username },
    );

    const ref = {
      referenceType: RENTAL_REFERENCE_TYPE,
      referenceId: draft.id,
    };
    const reason = input.reason?.trim() || 'reservation_checkout';

    for (const line of input.items) {
      await this.lifecycle.transition(
        line.itemId,
        {
          newState: ITEM_LIFECYCLE.RESERVED,
          expectedState: ITEM_LIFECYCLE.AVAILABLE,
          reason,
          ...ref,
        },
        actor,
        { tx, skipAudit: true },
      );
      await this.lifecycle.transition(
        line.itemId,
        {
          newState: ITEM_LIFECYCLE.RENTED,
          expectedState: ITEM_LIFECYCLE.RESERVED,
          reason,
          ...ref,
        },
        actor,
        { tx, skipAudit: true },
      );
    }

    const checkedOut = await this.repo.transitionStatus({
      rentalId: draft.id,
      from: RENTAL_STATUS.DRAFT,
      to: RENTAL_STATUS.CHECKED_OUT,
      reason: 'checkout',
      userId: actor?.userId ?? null,
      username: actor?.username ?? null,
      tx,
    });
    if (!checkedOut) {
      throw BusinessException.conflict('Concurrent rental checkout rejected');
    }

    const active = await this.repo.transitionStatus({
      rentalId: draft.id,
      from: RENTAL_STATUS.CHECKED_OUT,
      to: RENTAL_STATUS.ACTIVE,
      reason: 'handover_complete',
      userId: actor?.userId ?? null,
      username: actor?.username ?? null,
      tx,
    });
    if (!active) {
      throw BusinessException.conflict('Concurrent rental activation rejected');
    }
    return active;
  }

  async cancel(id: string, reason?: string, actor?: AuthPrincipal) {
    const rental = await this.requireLive(id);
    if (!canCancel(rental.status)) {
      throw BusinessException.conflict(
        `لا يمكن إلغاء التأجير في الحالة الحالية (${rental.status})`,
      );
    }
    const from = rental.status as RentalStatus;
    if (!canTransitionRentalStatus(from, RENTAL_STATUS.CANCELLED)) {
      throw BusinessException.conflict(
        `انتقال غير صالح: ${from} → ملغى`,
      );
    }

    const outbound = from !== RENTAL_STATUS.DRAFT;

    await this.availability.runExclusive(async (tx) => {
      // Authoritative cancel policy — reject partial/paid before inventory unwind.
      await this.settlements.applyRentalCancelPolicyInTx(
        tx,
        rental.id,
        actor,
        reason,
      );

      if (outbound) {
        for (const line of rental.items) {
          let expected: string = ITEM_LIFECYCLE.RENTED;
          for (const next of RENTAL_CANCEL_ITEM_PATH) {
            await this.lifecycle.transition(
              line.itemId,
              {
                newState: next,
                expectedState: expected,
                reason: reason?.trim() || 'rental_cancelled',
                referenceType: RENTAL_REFERENCE_TYPE,
                referenceId: rental.id,
              },
              actor,
              { tx, skipAudit: true },
            );
            expected = next;
          }
        }
      }

      const updated = await this.repo.transitionStatus({
        rentalId: rental.id,
        from,
        to: RENTAL_STATUS.CANCELLED,
        reason: reason?.trim() || 'cancel',
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
        tx,
      });
      if (!updated) {
        throw BusinessException.conflict('Concurrent rental cancel rejected');
      }
    });

    const updated = await this.requireLive(id);
    await this.audit.record({
      module: RENTAL_MODULE,
      entityType: RENTAL_ENTITY,
      entityId: id,
      action: 'cancel',
      oldValues: this.snapshot(rental),
      newValues: this.snapshot(updated),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return toRentalPublic(updated);
  }

  private where(q: ListRentalsDto): Prisma.RentalWhereInput {
    const w: Prisma.RentalWhereInput = {
      deletedAt:
        parseOptionalBoolean(q.deleted) === true ? { not: null } : null,
    };
    if (q.status) {
      const s = q.status.trim().toLowerCase();
      if (!isRentalStatus(s)) {
        throw BusinessException.validation('Invalid rental status filter');
      }
      w.status = s;
    }
    if (q.customerId) w.customerId = q.customerId;
    if (q.rentalNumber) {
      w.rentalNumber = { contains: q.rentalNumber.trim().toUpperCase() };
    }
    const text = normalizeSearchQuery(q.q);
    if (text) {
      w.OR = [
        { rentalNumber: { contains: text.toUpperCase() } },
        { notes: { contains: text } },
        { customer: { fullName: { contains: text } } },
      ];
    }
    return w;
  }

  private async prepareItems(items: CreateRentalItemDto[]) {
    const seen = new Set<string>();
    const prepared: Array<{
      itemId: string;
      barcodeValue: string | null;
      agreedRentalPrice: number;
      notes: string | null;
    }> = [];

    for (const line of items) {
      if (seen.has(line.itemId)) {
        throw BusinessException.validation(
          'Duplicate itemId in rental items',
        );
      }
      seen.add(line.itemId);
      const checked = await this.assertItemRentable(
        line.itemId,
        line.barcode ?? null,
      );
      prepared.push({
        itemId: line.itemId,
        barcodeValue: checked.barcodeValue,
        agreedRentalPrice:
          line.agreedRentalPrice ?? checked.rentalPrice ?? 0,
        notes: line.notes?.trim() || null,
      });
    }
    return prepared;
  }

  private async assertItemRentable(
    itemId: string,
    barcodeRaw: string | null,
  ): Promise<{ barcodeValue: string | null; rentalPrice: number }> {
    const item = await this.items.getById(itemId);
    if (item.status !== ITEM_STATUS.ACTIVE) {
      throw BusinessException.conflict(
        `Item ${item.internalCode} catalog status must be active`,
      );
    }
    if (
      !isRentable({
        deletedAt: item.deletedAt,
        status: item.status,
        lifecycleState: item.lifecycleState,
      })
    ) {
      throw BusinessException.conflict(
        `Item ${item.internalCode} is not rentable (lifecycle ${item.lifecycleState})`,
      );
    }

    const liveBarcodes = (item.barcodes ?? []).map((b) => ({
      id: b.id,
      value: 'barcode' in b && b.barcode ? b.barcode.code : (b as { value?: string }).value,
    }));
    if (liveBarcodes.length === 0 || liveBarcodes.some((b) => !b.value)) {
      throw BusinessException.conflict(
        `Item ${item.internalCode} has no active barcode`,
      );
    }

    let barcodeValue: string | null = null;
    if (barcodeRaw?.trim()) {
      const code = barcodeRaw.trim();
      const match = liveBarcodes.find((b) => b.value === code);
      if (!match) {
        throw BusinessException.validation(
          `Barcode ${code} is not bound to item ${item.internalCode}`,
        );
      }
      const platform = await this.barcodes.findByValue(code);
      if (!platform || platform.status !== BARCODE_STATUS.ACTIVATED) {
        throw BusinessException.conflict(`Barcode ${code} is not activated`);
      }
      if (platform.entityId && platform.entityId !== itemId) {
        throw BusinessException.conflict(
          `Barcode ${code} is bound to another entity`,
        );
      }
      barcodeValue = code;
    } else {
      barcodeValue = liveBarcodes[0]?.value ?? null;
      if (barcodeValue) {
        const platform = await this.barcodes.findByValue(barcodeValue);
        if (!platform || platform.status !== BARCODE_STATUS.ACTIVATED) {
          throw BusinessException.conflict(
            `Primary barcode for ${item.internalCode} is not activated`,
          );
        }
      }
    }

    return { barcodeValue, rentalPrice: item.rentalPrice };
  }

  private async requireActiveCustomer(customerId: string) {
    const customer = await this.customers.getById(customerId);
    if (customer.status !== CUSTOMER_STATUS.ACTIVE) {
      throw BusinessException.conflict('Customer is not active');
    }
    return customer;
  }

  private async requireLive(id: string): Promise<RentalWithRelations> {
    const row = await this.repo.findById(id);
    if (!row) throw BusinessException.notFound('Rental not found');
    return row;
  }

  private parseDate(raw: string, field: string): Date {
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) {
      throw BusinessException.validation(`Invalid ${field}`);
    }
    return d;
  }

  private async allocateNumber(): Promise<string> {
    return this.allocateNumberInTx();
  }

  private async allocateNumberInTx(
    tx?: Prisma.TransactionClient,
  ): Promise<string> {
    const prefix = (
      await this.settings.getString(
        RENTAL_NUMBER_SETTING.PREFIX,
        RENTAL_DEFAULT_PREFIX,
      )
    )
      .trim()
      .toUpperCase();
    const separator = await this.settings.getString(
      RENTAL_NUMBER_SETTING.SEPARATOR,
      RENTAL_DEFAULT_SEPARATOR,
    );
    const padding = await this.settings.getInt(
      RENTAL_NUMBER_SETTING.PADDING,
      RENTAL_DEFAULT_PADDING,
    );
    if (
      !/^[A-Z0-9]+$/.test(prefix) ||
      !Number.isInteger(padding) ||
      padding < 1 ||
      padding > 16
    ) {
      throw BusinessException.validation('Invalid rental number settings');
    }
    for (let i = 0; i < 25; i += 1) {
      const seq = await this.repo.nextSequence(`rental:${prefix}`, tx);
      const number = `${prefix}${separator}${String(seq).padStart(padding, '0')}`;
      if (!(await this.repo.findAnyNumber(number))) return number;
    }
    throw BusinessException.invariant('Unable to allocate rental number');
  }

  private snapshot(row: RentalWithRelations) {
    return {
      id: row.id,
      rentalNumber: row.rentalNumber,
      customerId: row.customerId,
      status: row.status,
      rentalDate: row.rentalDate,
      expectedReturnDate: row.expectedReturnDate,
      actualReturnDate: row.actualReturnDate,
      notes: row.notes,
      itemIds: row.items.map((i) => i.itemId),
      deletedAt: row.deletedAt,
    };
  }

  private parseJson(raw: string | null): unknown {
    if (raw == null || raw === '') return null;
    try {
      return JSON.parse(raw) as unknown;
    } catch {
      return raw;
    }
  }
}
