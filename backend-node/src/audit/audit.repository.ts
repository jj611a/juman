import { Injectable } from '@nestjs/common';
import type { AuditLog } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AuditRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    module: string;
    entityType: string;
    entityId: string | null;
    action: string;
    oldValues: string | null;
    newValues: string | null;
    userId: string | null;
    username: string | null;
    ipAddress: string | null;
    metadata: string | null;
    message: string | null;
  }): Promise<AuditLog> {
    return this.prisma.auditLog.create({ data });
  }

  list(input: {
    module?: string;
    entityType?: string;
    entityId?: string;
    action?: string;
    offset: number;
    limit: number;
  }): Promise<{ rows: AuditLog[]; total: number }> {
    const where = {
      ...(input.module ? { module: input.module } : {}),
      ...(input.entityType ? { entityType: input.entityType } : {}),
      ...(input.entityId ? { entityId: input.entityId } : {}),
      ...(input.action ? { action: input.action } : {}),
    };
    return Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: input.offset,
        take: input.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]).then(([rows, total]) => ({ rows, total }));
  }
}