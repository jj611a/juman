import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AuditService } from '../audit/audit.service';
import { CustomersService } from '../customers/customers.service';
import { FinanceService } from '../finance/finance.service';
import { Money } from '../finance/money/money.value';
import { SettingsService } from '../settings/settings.service';
import { AppLoggerService } from '../logging/app-logger.service';
import { BusinessException } from '../shared/errors/business.exception';
import {
  normalizePagination,
  paginated,
} from '../shared/pagination/pagination';
import { normalizeSearchQuery } from '../shared/search/search';
import { normalizeSort } from '../shared/sorting/sorting';
import type { AuthPrincipal } from '../shared/types';
import type {
  CreateSaleDto,
  ListSalesDto,
  SaleActionDto,
  SaleCompleteDto,
  SalePaymentDto,
} from './dto/sale.dto';
import { SalesTransactionService } from './sales-transaction.service';
import {
  SALE_DEFAULT_PADDING,
  SALE_DEFAULT_PREFIX,
  SALE_DEFAULT_SEPARATOR,
  SALE_ENTITY,
  SALE_MODULE,
  SALE_NUMBER_SETTING,
  SALE_SORT_FIELDS,
  SALE_STATUS,
} from './sales.constants';
import { toSalePublic, toSaleSnapshot } from './sales.mapper';
import { SalesRepository } from './sales.repository';
import { assertSaleQuantity, canSoftDeleteSale, isSaleStatus } from './sales.rules';
import { isSellable } from '../inventory/lifecycle/lifecycle.rules';

@Injectable()
export class SalesService implements OnModuleInit {
  constructor(
    private readonly repo: SalesRepository,
    private readonly txService: SalesTransactionService,
    private readonly customers: CustomersService,
    private readonly finance: FinanceService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly logger: AppLoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    const walkIn = await this.customers.ensureWalkInCustomer();
    await this.finance.ensureAccountForCustomer(walkIn.id);
    this.logger.startup('Walk-in customer ready', {
      customerId: walkIn.id,
      customerNumber: walkIn.customerNumber,
    });
  }

  async list(query: ListSalesDto) {
    const page = normalizePagination(query);
    const sort = normalizeSort(
      query.sortBy,
      query.sortDir,
      new Set(SALE_SORT_FIELDS),
      { field: 'createdAt', direction: 'desc' },
    );
    const where: Prisma.SaleWhereInput = { deletedAt: null };
    if (query.status) {
      if (!isSaleStatus(query.status)) {
        throw BusinessException.validation('Invalid sale status');
      }
      where.status = query.status;
    }
    if (query.customerId) where.customerId = query.customerId;
    if (query.saleNumber) {
      where.saleNumber = { contains: query.saleNumber.trim() };
    }
    const q = normalizeSearchQuery(query.q);
    if (q) {
      where.OR = [
        { saleNumber: { contains: q } },
        { notes: { contains: q } },
        { customer: { fullName: { contains: q } } },
      ];
    }
    const { rows, total } = await this.repo.list({
      where,
      orderBy: { [sort.field]: sort.direction },
      offset: page.offset,
      limit: page.limit,
    });
    return paginated(
      rows.map((r) => toSalePublic(r)),
      total,
      page,
    );
  }

  async getById(id: string) {
    return toSalePublic(await this.requireLive(id));
  }

  async history(id: string) {
    const sale = await this.requireLive(id);
    return sale.history.map((h) => ({
      id: h.id,
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      action: h.action,
      reason: h.reason,
      userId: h.userId,
      username: h.username,
      createdAt: h.createdAt,
    }));
  }

  async create(dto: CreateSaleDto, actor?: AuthPrincipal) {
    if (dto.customerId) {
      await this.customers.getById(dto.customerId);
    }

    const itemIds = dto.items.map((i) => i.itemId);
    if (new Set(itemIds).size !== itemIds.length) {
      throw BusinessException.validation('Duplicate items in sale');
    }

    const lines = [];
    let subtotal = 0;
    for (const line of dto.items) {
      const quantity = line.quantity ?? 1;
      assertSaleQuantity(quantity);
      const item = await this.repo.client.item.findFirst({
        where: { id: line.itemId, deletedAt: null },
        include: {
          barcodes: {
            where: { deletedAt: null },
            take: 1,
            include: { barcode: true },
          },
        },
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
      const price = Money.ofNonNegativeFils(
        line.priceFils ?? item.salePrice ?? 0,
      );
      const discount = Money.ofNonNegativeFils(line.discountFils ?? 0);
      if (discount.amountFils > price.amountFils) {
        throw BusinessException.validation('Line discount exceeds price');
      }
      const total = price.amountFils - discount.amountFils;
      subtotal += total;
      const barcodeSnapshot =
        line.barcode?.trim() ||
        item.barcodes[0]?.barcode?.code ||
        null;
      lines.push({
        itemId: item.id,
        priceFils: price.amountFils,
        discountFils: discount.amountFils,
        quantity,
        totalFils: total,
        barcodeSnapshot,
        itemNameSnapshot: item.displayName,
        createdBy: actor?.userId ?? null,
      });
    }

    const headerDiscount = Money.ofNonNegativeFils(dto.discountFils ?? 0);
    const tax = Money.ofNonNegativeFils(dto.taxFils ?? 0);
    if (headerDiscount.amountFils > subtotal) {
      throw BusinessException.validation('Sale discount exceeds subtotal');
    }
    const totalFils = subtotal - headerDiscount.amountFils + tax.amountFils;

    const saleNumber = await this.allocateNumber();
    const row = await this.repo.create(
      {
        saleNumber,
        customerId: dto.customerId ?? null,
        status: SALE_STATUS.DRAFT,
        subtotalFils: subtotal,
        discountFils: headerDiscount.amountFils,
        taxFils: tax.amountFils,
        totalFils,
        notes: dto.notes?.trim() || null,
        createdBy: actor?.userId ?? null,
        updatedBy: actor?.userId ?? null,
      },
      lines,
      { userId: actor?.userId, username: actor?.username },
    );

    const pub = toSalePublic(row);
    await this.audit.record({
      module: SALE_MODULE,
      entityType: SALE_ENTITY,
      entityId: row.id,
      action: 'created',
      newValues: toSaleSnapshot(row),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return pub;
  }

  confirm(id: string, body?: SaleActionDto, actor?: AuthPrincipal) {
    return this.txService.confirm(id, body, actor);
  }

  payment(id: string, dto: SalePaymentDto, actor?: AuthPrincipal) {
    return this.txService.payment(id, dto, actor);
  }

  complete(id: string, body?: SaleCompleteDto, actor?: AuthPrincipal) {
    return this.txService.complete(id, body, actor);
  }

  cancel(id: string, body?: SaleActionDto, actor?: AuthPrincipal) {
    return this.txService.cancel(id, body?.reason, actor, body?.idempotencyKey);
  }

  /**
   * Soft-delete policy (Phase 6.7.1): only draft/cancelled sales without live settlement.
   */
  async softDelete(id: string, actor?: AuthPrincipal) {
    const sale = await this.requireLive(id);
    if (!canSoftDeleteSale(sale.status)) {
      throw BusinessException.conflict(
        `Cannot soft-delete sale in status ${sale.status}`,
      );
    }
    const settlement = await this.repo.client.rentalSettlement.findFirst({
      where: {
        saleId: id,
        deletedAt: null,
        status: { not: 'cancelled' },
      },
    });
    if (settlement) {
      throw BusinessException.conflict(
        'Cannot soft-delete sale with a live settlement',
      );
    }
    await this.repo.client.sale.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: actor?.userId ?? null,
        updatedBy: actor?.userId ?? null,
      },
    });
    await this.audit.record({
      module: SALE_MODULE,
      entityType: SALE_ENTITY,
      entityId: id,
      action: 'soft_delete',
      oldValues: toSaleSnapshot(sale),
      actor: { userId: actor?.userId, username: actor?.username },
    });
    return { id, deleted: true };
  }

  private async requireLive(id: string) {
    const row = await this.repo.findById(id);
    if (!row) throw BusinessException.notFound('Sale not found');
    return row;
  }

  private async allocateNumber(): Promise<string> {
    const prefix =
      (await this.settings.getString(
        SALE_NUMBER_SETTING.PREFIX,
        SALE_DEFAULT_PREFIX,
      )) || SALE_DEFAULT_PREFIX;
    const separator =
      (await this.settings.getString(
        SALE_NUMBER_SETTING.SEPARATOR,
        SALE_DEFAULT_SEPARATOR,
      )) || SALE_DEFAULT_SEPARATOR;
    const padding = await this.settings.getInt(
      SALE_NUMBER_SETTING.PADDING,
      SALE_DEFAULT_PADDING,
    );

    for (let attempt = 0; attempt < 25; attempt++) {
      const seq = await this.repo.nextSequence(`sale:${prefix}`);
      const saleNumber = `${prefix}${separator}${String(seq).padStart(padding, '0')}`;
      const clash = await this.repo.findAnyNumber(saleNumber);
      if (!clash) return saleNumber;
    }
    throw BusinessException.conflict('Could not allocate sale number');
  }
}
