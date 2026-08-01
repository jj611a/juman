import { Injectable, OnModuleInit } from '@nestjs/common';
import type { AppSetting } from '@prisma/client';
import { AppLoggerService } from '../logging/app-logger.service';
import { SETTING_VALUE_TYPE } from '../shared/constants/business.constants';
import { DOMAIN_ERROR_CODE } from '../shared/errors/domain.errors';
import { BusinessException } from '../shared/errors/business.exception';
import { operatorMessage } from '../shared/localization/messages';
import { DEFAULT_APP_SETTINGS } from './settings.seeds';
import { SettingsRepository } from './settings.repository';

@Injectable()
export class SettingsService implements OnModuleInit {
  constructor(
    private readonly repo: SettingsRepository,
    private readonly logger: AppLoggerService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureDefaults();
  }

  async ensureDefaults(): Promise<number> {
    for (const seed of DEFAULT_APP_SETTINGS) {
      await this.repo.upsertSeed(seed);
    }
    this.logger.startup('App settings ensured', { count: DEFAULT_APP_SETTINGS.length });
    return DEFAULT_APP_SETTINGS.length;
  }

  list(category?: string): Promise<AppSetting[]> {
    return this.repo.listActive(category);
  }

  async getOrThrow(key: string): Promise<AppSetting> {
    const row = await this.repo.findByKey(key);
    if (!row) {
      throw BusinessException.notFound(`Setting not found: ${key}`);
    }
    return row;
  }

  async getString(key: string, fallback?: string): Promise<string> {
    const row = await this.repo.findByKey(key);
    if (!row) {
      if (fallback !== undefined) return fallback;
      throw BusinessException.notFound(`Setting not found: ${key}`);
    }
    return row.value;
  }

  async getInt(key: string, fallback?: number): Promise<number> {
    const raw = await this.getString(key, fallback !== undefined ? String(fallback) : undefined);
    const n = Number(raw);
    if (!Number.isInteger(n)) {
      throw BusinessException.invariant(`Setting ${key} is not an integer`);
    }
    return n;
  }

  async getBool(key: string, fallback?: boolean): Promise<boolean> {
    const raw = await this.getString(key, fallback !== undefined ? String(fallback) : undefined);
    if (raw === 'true' || raw === '1') return true;
    if (raw === 'false' || raw === '0') return false;
    throw BusinessException.invariant(`Setting ${key} is not a boolean`);
  }

  async getJson<T>(key: string, fallback?: T): Promise<T> {
    const row = await this.repo.findByKey(key);
    if (!row) {
      if (fallback !== undefined) return fallback;
      throw BusinessException.notFound(`Setting not found: ${key}`);
    }
    try {
      return JSON.parse(row.value) as T;
    } catch {
      throw BusinessException.invariant(`Setting ${key} is not valid JSON`);
    }
  }

  async setValue(key: string, value: unknown, updatedBy?: string): Promise<AppSetting> {
    const row = await this.getOrThrow(key);
    if (!row.isEditable) {
      throw new BusinessException(DOMAIN_ERROR_CODE.SETTING_READONLY, operatorMessage('setting.readonly'));
    }
    const serialized = this.serialize(row.valueType, value);
    return this.repo.updateValue(key, serialized, updatedBy);
  }

  private serialize(valueType: string, value: unknown): string {
    switch (valueType) {
      case SETTING_VALUE_TYPE.STRING:
        return String(value);
      case SETTING_VALUE_TYPE.INTEGER: {
        const n = Number(value);
        if (!Number.isInteger(n)) {
          throw BusinessException.validation('Value must be an integer');
        }
        return String(n);
      }
      case SETTING_VALUE_TYPE.BOOLEAN:
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (value === 'true' || value === 'false') return String(value);
        throw BusinessException.validation('Value must be a boolean');
      case SETTING_VALUE_TYPE.JSON:
        return JSON.stringify(value);
      default:
        return String(value);
    }
  }
}