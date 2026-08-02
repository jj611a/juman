import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { BarcodeService } from '../barcode/barcode.service';
import { CustomersService } from '../customers/customers.service';
import { CUSTOMER_STATUS } from '../customers/customers.constants';
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

    const row = await this.repo.create(
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

  /**
   * Checkout: draft → checked_out → active, inventory available → reserved → rented.
   * Entire mutation runs in one Prisma transaction; failure rolls back completely.
   */
  async checkout(id: string, reason?: string, actor?: AuthPrincipal) {
    const rental = await this.requireLive(id);
    if (!canCheckout(rental.status)) {
      throw BusinessException.conflict(
        `Cannot checkout rental in status ${rental.status}`,
      );
    }
    await this.requireActiveCustomer(rental.customerId);

    // Re-validate items are still rentable before opening the TX.
    for (const line of rental.items) {
      await this.assertItemRentable(line.itemId, line.barcodeValue);
    }

    const ref = {
      referenceType: RENTAL_REFERENCE_TYPE,
      referenceId: rental.id,
    };

    try {
      await this.repo.client.$transaction(async (tx) => {
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
      });
    } catch (e) {
      throw e;
    }

    // Audit inventory transitions after successful TX (no partial rental left).
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

    const updated = await this.requireLive(id);
    await this.audit.record({
      module: RENTAL_MODULE,
      entityType: RENTAL_ENTITY,
      entityId: id,
      action: 'checkout',
      oldValues: this.snapshot(rental),
      newValues: this.snapshot(updated),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return toRentalPublic(updated);
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

  async cancel(id: string, reason?: string, actor?: AuthPrincipal) {
    const rental = await this.requireLive(id);
    if (!canCancel(rental.status)) {
      throw BusinessException.conflict(
        `Cannot cancel rental in status ${rental.status}`,
      );
    }
    const from = rental.status as RentalStatus;
    if (!canTransitionRentalStatus(from, RENTAL_STATUS.CANCELLED)) {
      throw BusinessException.conflict(
        `Invalid rental transition: ${from} → ${RENTAL_STATUS.CANCELLED}`,
      );
    }

    const outbound = from !== RENTAL_STATUS.DRAFT;

    await this.repo.client.$transaction(async (tx) => {
      if (outbound) {
        for (const line of rental.items) {
          // rented → return_pending → inspection → available
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
      const seq = await this.repo.nextSequence(`rental:${prefix}`);
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
      itemIds: row.items.map((i) => i.itemId),
      deletedAt: row.deletedAt,
    };
  }
}
