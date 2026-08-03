import { ForbiddenException, Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { BusinessException } from '../shared/errors/business.exception';
import {
  normalizePagination,
  paginated,
} from '../shared/pagination/pagination';
import { normalizeSort, sortToOrderBy } from '../shared/sorting/sorting';
import type { AuthPrincipal } from '../shared/types';
import { ITEM_LIFECYCLE } from '../inventory/inventory.constants';
import { RENTAL_STATUS } from '../rentals/rentals.constants';
import { PAYMENT_STATUS } from '../finance/finance.constants';
import type { ReportExportQueryDto, ReportQueryDto } from './dto/report-query.dto';
import { ReportExportRegistry } from './export/export.registry';
import type { ReportExportPayload } from './export/report-exporter';
import {
  REPORT_KIND,
  REPORT_PERMISSION,
  type ReportKind,
} from './reports.constants';
import { ReportsRepository, type DateRange } from './reports.repository';

const RENTAL_SORT = new Set([
  'rentalDate',
  'expectedReturnDate',
  'actualReturnDate',
  'createdAt',
  'status',
  'rentalNumber',
]);

const RESERVATION_SORT = new Set([
  'startDate',
  'expectedCheckoutDate',
  'expectedReturnDate',
  'createdAt',
  'status',
  'reservationNumber',
]);

const ITEM_SORT = new Set([
  'internalCode',
  'displayName',
  'lifecycleState',
  'rentalPrice',
  'createdAt',
]);

const PAYMENT_SORT = new Set([
  'completedAt',
  'createdAt',
  'amountFils',
  'paymentNumber',
  'status',
]);

const ACTIVE_RENTAL_STATUSES: string[] = [
  RENTAL_STATUS.CHECKED_OUT,
  RENTAL_STATUS.ACTIVE,
  RENTAL_STATUS.RETURN_PENDING,
  RENTAL_STATUS.OVERDUE,
];

const FINANCIAL_KINDS = new Set<string>([REPORT_KIND.FINANCIAL]);

/**
 * Read-only reporting facade.
 * Must never call Inventory / Rental / Settlement / Finance write APIs.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly repo: ReportsRepository,
    private readonly exporters: ReportExportRegistry,
  ) {}

  dashboard() {
    return this.repo.dashboardSummary();
  }

  financial(query: ReportQueryDto) {
    return this.repo.financialSummary(this.dateRange(query));
  }

  rentalsCurrent(query: ReportQueryDto) {
    return this.listRentals(query, {
      status: query.status
        ? query.status
        : { in: ACTIVE_RENTAL_STATUSES },
    });
  }

  rentalsOverdue(query: ReportQueryDto) {
    return this.listRentals(query, {
      status: query.status ?? RENTAL_STATUS.OVERDUE,
    });
  }

  rentalsReturns(query: ReportQueryDto) {
    const range = this.dateRange(query);
    const actualReturnDate: Prisma.DateTimeNullableFilter = {
      not: null,
    };
    if (range.from) actualReturnDate.gte = range.from;
    if (range.to) actualReturnDate.lte = range.to;
    return this.listRentals(query, {
      actualReturnDate,
      ...(query.status ? { status: query.status } : {}),
    });
  }

  rentalsHistory(query: ReportQueryDto) {
    const range = this.dateRange(query);
    const where: Prisma.RentalWhereInput = {};
    if (query.status) where.status = query.status;
    if (range.from || range.to) {
      where.rentalDate = {};
      if (range.from) where.rentalDate.gte = range.from;
      if (range.to) where.rentalDate.lte = range.to;
    }
    return this.listRentals(query, where);
  }

  rentalsReservations(query: ReportQueryDto) {
    return this.listReservations(query, {});
  }

  inventoryValue(query: ReportQueryDto) {
    return this.repo.inventoryValue(this.itemWhere(query));
  }

  inventoryAvailability() {
    return this.repo.inventoryAvailability();
  }

  inventoryCategory() {
    return this.repo.inventoryGroupByTaxonomy('categoryId');
  }

  inventoryBrand() {
    return this.repo.inventoryGroupByTaxonomy('brandId');
  }

  inventoryColor() {
    return this.repo.inventoryGroupByTaxonomy('colorId');
  }

  inventorySize() {
    return this.repo.inventoryGroupByTaxonomy('sizeId');
  }

  inventoryLifecycle() {
    return this.repo.inventoryAvailability();
  }

  inventoryRetired(query: ReportQueryDto) {
    return this.listItems(query, {
      lifecycleState: ITEM_LIFECYCLE.RETIRED,
    });
  }

  inventoryMaintenance(query: ReportQueryDto) {
    return this.listItems(query, {
      lifecycleState: ITEM_LIFECYCLE.MAINTENANCE,
    });
  }

  async customerRentals(customerId: string, query: ReportQueryDto) {
    await this.requireCustomer(customerId);
    return this.listRentals(query, { customerId });
  }

  async customerOutstanding(customerId: string) {
    await this.requireCustomer(customerId);
    return this.repo.customerOutstanding(customerId);
  }

  async customerPayments(customerId: string, query: ReportQueryDto) {
    await this.requireCustomer(customerId);
    const page = normalizePagination(query);
    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      PAYMENT_SORT,
      { field: 'createdAt', direction: 'desc' },
    );
    const range = this.dateRange(query);
    const where: Prisma.PaymentWhereInput = {
      deletedAt: null,
      account: { customerId, deletedAt: null },
    };
    if (query.status) where.status = query.status;
    else where.status = PAYMENT_STATUS.COMPLETED;
    if (query.settlementId) where.settlementId = query.settlementId;
    if (range.from || range.to) {
      where.completedAt = {};
      if (range.from) where.completedAt.gte = range.from;
      if (range.to) where.completedAt.lte = range.to;
    }
    const { rows, total } = await this.repo.listPayments({
      where,
      orderBy: sortToOrderBy(sort),
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(rows, total, page);
  }

  async customerReservations(customerId: string, query: ReportQueryDto) {
    await this.requireCustomer(customerId);
    return this.listReservations(query, { customerId });
  }

  async export(query: ReportExportQueryDto, principal: AuthPrincipal) {
    this.assertFinancialAccess(query.report, principal);
    const data = await this.resolve(query.report as ReportKind, query);
    const payload = this.toExportPayload(query.report as ReportKind, data);
    return this.exporters.export(query.format, payload);
  }

  implementedExportFormats() {
    return this.exporters.implementedFormats();
  }

  private assertFinancialAccess(kind: string, principal: AuthPrincipal) {
    if (!FINANCIAL_KINDS.has(kind)) return;
    if (!principal.permissions.includes(REPORT_PERMISSION.FINANCIAL_VIEW)) {
      throw new ForbiddenException('Insufficient permissions');
    }
  }

  private async resolve(kind: ReportKind, query: ReportQueryDto) {
    switch (kind) {
      case REPORT_KIND.DASHBOARD:
        return this.dashboard();
      case REPORT_KIND.FINANCIAL:
        return this.financial(query);
      case REPORT_KIND.RENTALS_CURRENT:
        return this.rentalsCurrent(query);
      case REPORT_KIND.RENTALS_OVERDUE:
        return this.rentalsOverdue(query);
      case REPORT_KIND.RENTALS_RETURNS:
        return this.rentalsReturns(query);
      case REPORT_KIND.RENTALS_RESERVATIONS:
        return this.rentalsReservations(query);
      case REPORT_KIND.RENTALS_HISTORY:
        return this.rentalsHistory(query);
      case REPORT_KIND.INVENTORY_VALUE:
        return this.inventoryValue(query);
      case REPORT_KIND.INVENTORY_AVAILABILITY:
      case REPORT_KIND.INVENTORY_LIFECYCLE:
        return this.inventoryAvailability();
      case REPORT_KIND.INVENTORY_CATEGORY:
        return this.inventoryCategory();
      case REPORT_KIND.INVENTORY_BRAND:
        return this.inventoryBrand();
      case REPORT_KIND.INVENTORY_COLOR:
        return this.inventoryColor();
      case REPORT_KIND.INVENTORY_SIZE:
        return this.inventorySize();
      case REPORT_KIND.INVENTORY_RETIRED:
        return this.inventoryRetired(query);
      case REPORT_KIND.INVENTORY_MAINTENANCE:
        return this.inventoryMaintenance(query);
      case REPORT_KIND.CUSTOMER_RENTALS:
        if (!query.customerId) {
          throw BusinessException.validation('customerId is required');
        }
        return this.customerRentals(query.customerId, query);
      case REPORT_KIND.CUSTOMER_OUTSTANDING:
        if (!query.customerId) {
          throw BusinessException.validation('customerId is required');
        }
        return this.customerOutstanding(query.customerId);
      case REPORT_KIND.CUSTOMER_PAYMENTS:
        if (!query.customerId) {
          throw BusinessException.validation('customerId is required');
        }
        return this.customerPayments(query.customerId, query);
      case REPORT_KIND.CUSTOMER_RESERVATIONS:
        if (!query.customerId) {
          throw BusinessException.validation('customerId is required');
        }
        return this.customerReservations(query.customerId, query);
      default:
        throw BusinessException.validation(`Unknown report: ${kind}`);
    }
  }

  private toExportPayload(
    kind: ReportKind,
    data: unknown,
  ): ReportExportPayload {
    const generatedAt = new Date().toISOString();
    const title = `report-${kind}`;
    if (data && typeof data === 'object' && 'items' in data) {
      const page = data as { items: readonly Record<string, unknown>[]; meta?: unknown };
      return {
        title,
        generatedAt,
        rows: page.items.map((row) => this.flatten(row)),
        meta: { kind, pagination: page.meta },
      };
    }
    if (Array.isArray(data)) {
      return {
        title,
        generatedAt,
        rows: data.map((row) => this.flatten(row as Record<string, unknown>)),
        meta: { kind },
      };
    }
    return {
      title,
      generatedAt,
      rows: [this.flatten(data as Record<string, unknown>)],
      meta: { kind },
    };
  }

  private flatten(row: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row ?? {})) {
      if (value instanceof Date) {
        out[key] = value.toISOString();
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [nestedKey, nestedVal] of Object.entries(
          value as Record<string, unknown>,
        )) {
          out[`${key}.${nestedKey}`] =
            nestedVal instanceof Date
              ? nestedVal.toISOString()
              : nestedVal;
        }
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  private async listRentals(
    query: ReportQueryDto,
    extra: Prisma.RentalWhereInput,
  ) {
    const page = normalizePagination(query);
    const sort = normalizeSort(query.sortBy, query.sortDir, RENTAL_SORT, {
      field: 'rentalDate',
      direction: 'desc',
    });
    const where: Prisma.RentalWhereInput = {
      deletedAt: null,
      ...extra,
      ...this.rentalFilters(query),
    };
    const { rows, total } = await this.repo.listRentals({
      where,
      orderBy: sortToOrderBy(sort),
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(rows, total, page);
  }

  private async listReservations(
    query: ReportQueryDto,
    extra: Prisma.ReservationWhereInput,
  ) {
    const page = normalizePagination(query);
    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      RESERVATION_SORT,
      { field: 'startDate', direction: 'desc' },
    );
    const range = this.dateRange(query);
    const where: Prisma.ReservationWhereInput = {
      deletedAt: null,
      ...extra,
    };
    if (query.status) where.status = query.status;
    if (query.customerId) where.customerId = query.customerId;
    if (query.employeeId) where.createdBy = query.employeeId;
    if (query.itemId) where.items = { some: { itemId: query.itemId } };
    if (range.from || range.to) {
      where.startDate = {};
      if (range.from) where.startDate.gte = range.from;
      if (range.to) where.startDate.lte = range.to;
    }
    const { rows, total } = await this.repo.listReservations({
      where,
      orderBy: sortToOrderBy(sort),
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(rows, total, page);
  }

  private async listItems(
    query: ReportQueryDto,
    extra: Prisma.ItemWhereInput,
  ) {
    const page = normalizePagination(query);
    const sort = normalizeSort(query.sortBy, query.sortDir, ITEM_SORT, {
      field: 'internalCode',
      direction: 'asc',
    });
    const where: Prisma.ItemWhereInput = {
      ...this.itemWhere(query),
      ...extra,
    };
    const { rows, total } = await this.repo.listItems({
      where,
      orderBy: sortToOrderBy(sort),
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(rows, total, page);
  }

  private rentalFilters(query: ReportQueryDto): Prisma.RentalWhereInput {
    const where: Prisma.RentalWhereInput = {};
    if (query.customerId) where.customerId = query.customerId;
    if (query.employeeId) where.createdBy = query.employeeId;
    if (query.itemId) where.items = { some: { itemId: query.itemId } };
    if (query.settlementId) {
      where.settlement = { id: query.settlementId };
    }
    return where;
  }

  private itemWhere(query: ReportQueryDto): Prisma.ItemWhereInput {
    const where: Prisma.ItemWhereInput = { deletedAt: null };
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.brandId) where.brandId = query.brandId;
    if (query.colorId) where.colorId = query.colorId;
    if (query.sizeId) where.sizeId = query.sizeId;
    if (query.itemId) where.id = query.itemId;
    if (query.status) where.status = query.status;
    return where;
  }

  private dateRange(query: ReportQueryDto): DateRange {
    return {
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
    };
  }

  private async requireCustomer(customerId: string) {
    const customer = await this.repo.findCustomer(customerId);
    if (!customer) {
      throw BusinessException.notFound(`Customer not found: ${customerId}`);
    }
    return customer;
  }
}
