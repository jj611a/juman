import { Injectable } from '@nestjs/common';
import type { Customer, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { liveWhere, softDeleteData, restoreSoftDeleteData } from '../shared/soft-delete/soft-delete';
import type { CustomerSortField } from './customers.constants';

@Injectable()
export class CustomersRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: Prisma.CustomerCreateInput): Promise<Customer> {
    return this.prisma.customer.create({ data });
  }

  update(id: string, data: Prisma.CustomerUpdateInput): Promise<Customer> {
    return this.prisma.customer.update({ where: { id }, data });
  }

  findById(id: string, opts?: { includeDeleted?: boolean }): Promise<Customer | null> {
    if (opts?.includeDeleted) {
      return this.prisma.customer.findUnique({ where: { id } });
    }
    return this.prisma.customer.findFirst({ where: liveWhere({ id }) });
  }

  findByNumber(customerNumber: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: liveWhere({ customerNumber }),
    });
  }

  findAnyByNumber(customerNumber: string): Promise<Customer | null> {
    return this.prisma.customer.findUnique({ where: { customerNumber } });
  }

  findActiveByPhoneNormalized(phoneNormalized: string, excludeId?: string): Promise<Customer | null> {
    return this.prisma.customer.findFirst({
      where: {
        phoneNormalized,
        status: 'active',
        deletedAt: null,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    });
  }

  async nextSequence(prefix: string): Promise<number> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.sequenceCounter.findUnique({ where: { prefix } });
      if (!existing) {
        await tx.sequenceCounter.create({ data: { prefix, lastValue: 1 } });
        return 1;
      }
      const updated = await tx.sequenceCounter.update({
        where: { prefix },
        data: { lastValue: existing.lastValue + 1 },
      });
      return updated.lastValue;
    });
  }

  softDelete(id: string, deletedBy?: string): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...softDeleteData(),
        deletedBy: deletedBy ?? null,
        status: 'inactive',
      },
    });
  }

  restore(id: string, updatedBy?: string): Promise<Customer> {
    return this.prisma.customer.update({
      where: { id },
      data: {
        ...restoreSoftDeleteData(),
        deletedBy: null,
        status: 'active',
        updatedBy: updatedBy ?? null,
      },
    });
  }

  async list(input: {
    where: Prisma.CustomerWhereInput;
    orderBy: Prisma.CustomerOrderByWithRelationInput;
    offset: number;
    limit: number;
  }): Promise<{ rows: Customer[]; total: number }> {
    const [rows, total] = await Promise.all([
      this.prisma.customer.findMany({
        where: input.where,
        orderBy: input.orderBy,
        skip: input.offset,
        take: input.limit,
      }),
      this.prisma.customer.count({ where: input.where }),
    ]);
    return { rows, total };
  }

  sortFieldToOrder(
    field: CustomerSortField,
    direction: 'asc' | 'desc',
  ): Prisma.CustomerOrderByWithRelationInput {
    if (field === 'phone') return { phoneNormalized: direction };
    return { [field]: direction } as Prisma.CustomerOrderByWithRelationInput;
  }
}