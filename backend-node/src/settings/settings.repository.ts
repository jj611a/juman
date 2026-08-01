import { Injectable } from '@nestjs/common';
import type { AppSetting } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { liveWhere } from '../shared/soft-delete/soft-delete';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByKey(key: string): Promise<AppSetting | null> {
    return this.prisma.appSetting.findFirst({ where: liveWhere({ key }) });
  }

  listActive(category?: string): Promise<AppSetting[]> {
    return this.prisma.appSetting.findMany({
      where: liveWhere(category ? { category } : {}),
      orderBy: [{ category: 'asc' }, { key: 'asc' }],
    });
  }

  upsertSeed(input: {
    key: string;
    value: string;
    valueType: string;
    category: string;
    description: string;
    isEditable: boolean;
  }): Promise<AppSetting> {
    return this.prisma.appSetting.upsert({
      where: { key: input.key },
      create: { ...input },
      update: {
        valueType: input.valueType,
        category: input.category,
        description: input.description,
        isEditable: input.isEditable,
        deletedAt: null,
      },
    });
  }

  updateValue(key: string, value: string, updatedBy?: string): Promise<AppSetting> {
    return this.prisma.appSetting.update({
      where: { key },
      data: { value, updatedBy: updatedBy ?? null },
    });
  }
}