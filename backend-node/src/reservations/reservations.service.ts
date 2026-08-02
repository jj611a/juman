import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { BarcodeService } from '../barcode/barcode.service';
import { CustomersService } from '../customers/customers.service';
import { CUSTOMER_STATUS } from '../customers/customers.constants';
import { ItemsService } from '../inventory/items/items.service';
import { ITEM_STATUS } from '../inventory/inventory.constants';
import { isRentable } from '../inventory/lifecycle/lifecycle.rules';
import { RentalsService } from '../rentals/rentals.service';
import { SettingsService } from '../settings/settings.service';
import { BARCODE_STATUS } from '../shared/constants/business.constants';
import { BusinessException } from '../shared/errors/business.exception';
import {
  normalizePagination,
  paginated,
} from '../shared/pagination/pagination';
import { normalizeSearchQuery } from '../shared/search/search';
import { normalizeSort } from '../shared/sorting/sorting';
import { parseOptionalBoolean } from '../shared/validation/parse-boolean';
import type { AuthPrincipal } from '../shared/types';
import { AvailabilityService } from './availability/availability.service';
import type {
  CreateReservationDto,
  CreateReservationItemDto,
  ListReservationsDto,
} from './dto/reservation.dto';
import { toReservationPublic } from './reservations.mapper';
import {
  RESERVATION_DEFAULT_PADDING,
  RESERVATION_DEFAULT_PREFIX,
  RESERVATION_DEFAULT_SEPARATOR,
  RESERVATION_ENTITY,
  RESERVATION_MODULE,
  RESERVATION_NUMBER_SETTING,
  RESERVATION_SORT_FIELDS,
  RESERVATION_STATUS,
} from './reservations.constants';
import {
  canCancelReservation,
  canCheckoutReservation,
  canExpireReservation,
  isReservationStatus,
} from './reservations.rules';
import {
  ReservationsRepository,
  type ReservationWithRelations,
} from './reservations.repository';

@Injectable()
export class ReservationsService {
  constructor(
    private readonly repo: ReservationsRepository,
    private readonly availability: AvailabilityService,
    private readonly customers: CustomersService,
    private readonly items: ItemsService,
    private readonly barcodes: BarcodeService,
    private readonly rentals: RentalsService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateReservationDto, actor?: AuthPrincipal) {
    await this.requireActiveCustomer(dto.customerId);
    const startDate = this.parseDate(dto.startDate, 'startDate');
    const expectedCheckoutDate = this.parseDate(
      dto.expectedCheckoutDate,
      'expectedCheckoutDate',
    );
    const expectedReturnDate = this.parseDate(
      dto.expectedReturnDate,
      'expectedReturnDate',
    );
    this.assertDateOrder(startDate, expectedCheckoutDate, expectedReturnDate);

    const prepared = await this.prepareItems(dto.items);
    await this.availability.assertItemsAvailable(
      prepared.map((p) => p.itemId),
      startDate,
      expectedReturnDate,
    );

    const reservationNumber = await this.allocateNumber();
    const row = await this.repo.createConfirmed({
      data: {
        reservationNumber,
        customerId: dto.customerId,
        startDate,
        expectedCheckoutDate,
        expectedReturnDate,
        notes: dto.notes?.trim() || null,
        createdBy: actor?.userId ?? null,
        updatedBy: actor?.userId ?? null,
      },
      items: prepared.map((p) => ({
        itemId: p.itemId,
        barcodeValue: p.barcodeValue,
        agreedRentalPrice: p.agreedRentalPrice,
        notes: p.notes,
        createdBy: actor?.userId ?? null,
      })),
      actor: { userId: actor?.userId, username: actor?.username },
    });

    await this.audit.recordCreate(
      RESERVATION_MODULE,
      RESERVATION_ENTITY,
      row.id,
      this.snapshot(row),
      { userId: actor?.userId, username: actor?.username },
    );
    await this.audit.record({
      module: RESERVATION_MODULE,
      entityType: RESERVATION_ENTITY,
      entityId: row.id,
      action: 'confirmed',
      newValues: { status: RESERVATION_STATUS.CONFIRMED },
      actor: { userId: actor?.userId, username: actor?.username },
    });

    return toReservationPublic(row);
  }

  async list(query: ListReservationsDto) {
    const page = normalizePagination(query);
    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      new Set(RESERVATION_SORT_FIELDS),
      { field: 'createdAt', direction: 'desc' },
    );
    const { rows, total } = await this.repo.list({
      where: this.where(query),
      orderBy: { [sort.field]: sort.direction },
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(rows.map(toReservationPublic), total, page);
  }

  async getById(id: string) {
    return toReservationPublic(await this.requireLive(id));
  }

  /**
   * Checkout: create Rental + inventory transitions + mark reservation checked_out.
   * Single transaction — full rollback on failure.
   */
  async checkout(id: string, reason?: string, actor?: AuthPrincipal) {
    const reservation = await this.requireLive(id);
    if (!canCheckoutReservation(reservation.status)) {
      throw BusinessException.conflict(
        `Cannot checkout reservation in status ${reservation.status}`,
      );
    }
    await this.requireActiveCustomer(reservation.customerId);

    for (const line of reservation.items) {
      await this.assertItemRentable(line.itemId, line.barcodeValue);
    }
    await this.availability.assertItemsAvailable(
      reservation.items.map((i) => i.itemId),
      reservation.startDate,
      reservation.expectedReturnDate,
      { excludeReservationId: reservation.id },
    );

    let rentalId = '';
    await this.repo.client.$transaction(async (tx) => {
      const rental = await this.rentals.materializeActiveFromReservation(
        {
          reservationId: reservation.id,
          customerId: reservation.customerId,
          rentalDate: reservation.expectedCheckoutDate,
          expectedReturnDate: reservation.expectedReturnDate,
          notes: reservation.notes,
          items: reservation.items.map((i) => ({
            itemId: i.itemId,
            barcodeValue: i.barcodeValue,
            agreedRentalPrice: i.agreedRentalPrice,
            notes: i.notes,
          })),
          reason: reason?.trim() || 'reservation_checkout',
        },
        tx,
        actor,
      );
      rentalId = rental.id;

      const updated = await this.repo.transitionStatus({
        reservationId: reservation.id,
        from: RESERVATION_STATUS.CONFIRMED,
        to: RESERVATION_STATUS.CHECKED_OUT,
        reason: reason?.trim() || 'checkout',
        userId: actor?.userId ?? null,
        username: actor?.username ?? null,
        tx,
      });
      if (!updated) {
        throw BusinessException.conflict(
          'Concurrent reservation checkout rejected',
        );
      }
    });

    const updated = await this.requireLive(id);
    await this.audit.record({
      module: RESERVATION_MODULE,
      entityType: RESERVATION_ENTITY,
      entityId: id,
      action: 'checkout',
      oldValues: this.snapshot(reservation),
      newValues: { ...this.snapshot(updated), rentalId },
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return toReservationPublic(updated);
  }

  async cancel(id: string, reason?: string, actor?: AuthPrincipal) {
    const reservation = await this.requireLive(id);
    if (!canCancelReservation(reservation.status)) {
      throw BusinessException.conflict(
        `Cannot cancel reservation in status ${reservation.status}`,
      );
    }
    const updated = await this.repo.transitionStatus({
      reservationId: reservation.id,
      from: reservation.status,
      to: RESERVATION_STATUS.CANCELLED,
      reason: reason?.trim() || 'cancel',
      userId: actor?.userId ?? null,
      username: actor?.username ?? null,
    });
    if (!updated) {
      throw BusinessException.conflict('Concurrent reservation cancel rejected');
    }
    await this.audit.record({
      module: RESERVATION_MODULE,
      entityType: RESERVATION_ENTITY,
      entityId: id,
      action: 'cancel',
      oldValues: this.snapshot(reservation),
      newValues: this.snapshot(updated),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return toReservationPublic(updated);
  }

  /** Expiration foundation — no scheduler; callable by ops/jobs later. */
  async expireReservation(id: string, reason?: string, actor?: AuthPrincipal) {
    const reservation = await this.requireLive(id);
    if (!canExpireReservation(reservation.status)) {
      throw BusinessException.conflict(
        `Cannot expire reservation in status ${reservation.status}`,
      );
    }
    const updated = await this.repo.transitionStatus({
      reservationId: reservation.id,
      from: reservation.status,
      to: RESERVATION_STATUS.EXPIRED,
      reason: reason?.trim() || 'expire',
      userId: actor?.userId ?? null,
      username: actor?.username ?? null,
    });
    if (!updated) {
      throw BusinessException.conflict('Concurrent reservation expire rejected');
    }
    await this.audit.record({
      module: RESERVATION_MODULE,
      entityType: RESERVATION_ENTITY,
      entityId: id,
      action: 'expired',
      oldValues: this.snapshot(reservation),
      newValues: this.snapshot(updated),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return toReservationPublic(updated);
  }

  private where(q: ListReservationsDto): Prisma.ReservationWhereInput {
    const w: Prisma.ReservationWhereInput = {
      deletedAt:
        parseOptionalBoolean(q.deleted) === true ? { not: null } : null,
    };
    if (q.status) {
      const s = q.status.trim().toLowerCase();
      if (!isReservationStatus(s)) {
        throw BusinessException.validation('Invalid reservation status filter');
      }
      w.status = s;
    }
    if (q.customerId) w.customerId = q.customerId;
    if (q.reservationNumber) {
      w.reservationNumber = {
        contains: q.reservationNumber.trim().toUpperCase(),
      };
    }
    const text = normalizeSearchQuery(q.q);
    if (text) {
      w.OR = [
        { reservationNumber: { contains: text.toUpperCase() } },
        { notes: { contains: text } },
        { customer: { fullName: { contains: text } } },
      ];
    }
    return w;
  }

  private assertDateOrder(
    start: Date,
    checkout: Date,
    ret: Date,
  ): void {
    if (checkout.getTime() < start.getTime()) {
      throw BusinessException.validation(
        'expectedCheckoutDate must be on or after startDate',
      );
    }
    if (ret.getTime() < checkout.getTime()) {
      throw BusinessException.validation(
        'expectedReturnDate must be on or after expectedCheckoutDate',
      );
    }
  }

  private async prepareItems(items: CreateReservationItemDto[]) {
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
          'Duplicate itemId in reservation items',
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
      value:
        'barcode' in b && b.barcode
          ? b.barcode.code
          : (b as { value?: string }).value,
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

  private async requireLive(id: string): Promise<ReservationWithRelations> {
    const row = await this.repo.findById(id);
    if (!row) throw BusinessException.notFound('Reservation not found');
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
        RESERVATION_NUMBER_SETTING.PREFIX,
        RESERVATION_DEFAULT_PREFIX,
      )
    )
      .trim()
      .toUpperCase();
    const separator = await this.settings.getString(
      RESERVATION_NUMBER_SETTING.SEPARATOR,
      RESERVATION_DEFAULT_SEPARATOR,
    );
    const padding = await this.settings.getInt(
      RESERVATION_NUMBER_SETTING.PADDING,
      RESERVATION_DEFAULT_PADDING,
    );
    if (
      !/^[A-Z0-9]+$/.test(prefix) ||
      !Number.isInteger(padding) ||
      padding < 1 ||
      padding > 16
    ) {
      throw BusinessException.validation('Invalid reservation number settings');
    }
    for (let i = 0; i < 25; i += 1) {
      const seq = await this.repo.nextSequence(`reservation:${prefix}`);
      const number = `${prefix}${separator}${String(seq).padStart(padding, '0')}`;
      if (!(await this.repo.findAnyNumber(number))) return number;
    }
    throw BusinessException.invariant('Unable to allocate reservation number');
  }

  private snapshot(row: ReservationWithRelations) {
    return {
      id: row.id,
      reservationNumber: row.reservationNumber,
      customerId: row.customerId,
      status: row.status,
      startDate: row.startDate,
      expectedCheckoutDate: row.expectedCheckoutDate,
      expectedReturnDate: row.expectedReturnDate,
      itemIds: row.items.map((i) => i.itemId),
      deletedAt: row.deletedAt,
    };
  }
}
