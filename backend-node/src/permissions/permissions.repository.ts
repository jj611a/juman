import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class PermissionsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByKey(key: string) {
    return this.prisma.permission.findFirst({
      where: { key, deletedAt: null },
    });
  }

  findAllActive() {
    return this.prisma.permission.findMany({
      where: { deletedAt: null },
      orderBy: { key: 'asc' },
    });
  }

  upsertByKey(input: {
    key: string;
    displayName: string;
    description: string;
    module: string;
  }) {
    return this.prisma.permission.upsert({
      where: { key: input.key },
      create: {
        key: input.key,
        displayName: input.displayName,
        description: input.description,
        module: input.module,
      },
      update: {
        displayName: input.displayName,
        description: input.description,
        module: input.module,
        deletedAt: null,
      },
    });
  }
}
