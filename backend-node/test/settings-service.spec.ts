import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsService } from '../src/settings/settings.service';
import { BusinessException } from '../src/shared/errors/business.exception';
import { SETTING_VALUE_TYPE } from '../src/shared/constants/business.constants';

describe('SettingsService', () => {
  const repo = {
    upsertSeed: vi.fn(),
    listActive: vi.fn(),
    findByKey: vi.fn(),
    updateValue: vi.fn(),
  };
  const logger = { startup: vi.fn() };
  let service: SettingsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SettingsService(repo as never, logger as never);
  });

  it('ensures defaults on init', async () => {
    repo.upsertSeed.mockResolvedValue({});
    await service.onModuleInit();
    expect(repo.upsertSeed).toHaveBeenCalled();
    expect(logger.startup).toHaveBeenCalled();
  });

  it('lists and gets typed values', async () => {
    repo.listActive.mockResolvedValue([{ key: 'a' }]);
    expect(await service.list('system')).toEqual([{ key: 'a' }]);

    repo.findByKey.mockResolvedValue({
      key: 'currency.code',
      value: 'IQD',
      valueType: SETTING_VALUE_TYPE.STRING,
      isEditable: false,
    });
    expect(await service.getString('currency.code')).toBe('IQD');
    expect(await service.getOrThrow('currency.code')).toMatchObject({ key: 'currency.code' });

    repo.findByKey.mockResolvedValue({ key: 'n', value: '12', valueType: 'integer', isEditable: true });
    expect(await service.getInt('n')).toBe(12);

    repo.findByKey.mockResolvedValue({ key: 'b', value: 'true', valueType: 'boolean', isEditable: true });
    expect(await service.getBool('b')).toBe(true);

    repo.findByKey.mockResolvedValue({ key: 'j', value: '{"a":1}', valueType: 'json', isEditable: true });
    expect(await service.getJson<{ a: number }>('j')).toEqual({ a: 1 });
  });

  it('uses fallbacks and rejects bad types', async () => {
    repo.findByKey.mockResolvedValue(null);
    expect(await service.getString('missing', 'x')).toBe('x');
    expect(await service.getInt('missing', 3)).toBe(3);
    expect(await service.getBool('missing', false)).toBe(false);
    expect(await service.getJson('missing', { z: 1 })).toEqual({ z: 1 });
    await expect(service.getString('missing')).rejects.toBeInstanceOf(BusinessException);

    repo.findByKey.mockResolvedValue({ key: 'n', value: 'nope', valueType: 'integer', isEditable: true });
    await expect(service.getInt('n')).rejects.toBeInstanceOf(BusinessException);

    repo.findByKey.mockResolvedValue({ key: 'b', value: 'maybe', valueType: 'boolean', isEditable: true });
    await expect(service.getBool('b')).rejects.toBeInstanceOf(BusinessException);

    repo.findByKey.mockResolvedValue({ key: 'j', value: '{', valueType: 'json', isEditable: true });
    await expect(service.getJson('j')).rejects.toBeInstanceOf(BusinessException);
  });

  it('updates editable settings and blocks readonly', async () => {
    repo.findByKey.mockResolvedValue({
      key: 'company.name',
      value: 'old',
      valueType: SETTING_VALUE_TYPE.STRING,
      isEditable: true,
    });
    repo.updateValue.mockResolvedValue({ key: 'company.name', value: 'new' });
    await service.setValue('company.name', 'new', 'u1');
    expect(repo.updateValue).toHaveBeenCalledWith('company.name', 'new', 'u1');

    repo.findByKey.mockResolvedValue({
      key: 'currency.code',
      value: 'IQD',
      valueType: SETTING_VALUE_TYPE.STRING,
      isEditable: false,
    });
    await expect(service.setValue('currency.code', 'USD')).rejects.toBeInstanceOf(BusinessException);

    repo.findByKey.mockResolvedValue({
      key: 'barcode.padding',
      value: '8',
      valueType: SETTING_VALUE_TYPE.INTEGER,
      isEditable: true,
    });
    repo.updateValue.mockResolvedValue({});
    await service.setValue('barcode.padding', 10);
    expect(repo.updateValue).toHaveBeenCalledWith('barcode.padding', '10', undefined);

    repo.findByKey.mockResolvedValue({
      key: 'flag',
      value: 'false',
      valueType: SETTING_VALUE_TYPE.BOOLEAN,
      isEditable: true,
    });
    await service.setValue('flag', true);
    expect(repo.updateValue).toHaveBeenCalledWith('flag', 'true', undefined);

    repo.findByKey.mockResolvedValue({
      key: 'meta',
      value: '{}',
      valueType: SETTING_VALUE_TYPE.JSON,
      isEditable: true,
    });
    await service.setValue('meta', { a: 1 });
    expect(repo.updateValue).toHaveBeenCalledWith('meta', '{"a":1}', undefined);

    repo.findByKey.mockResolvedValue({
      key: 'badint',
      value: '1',
      valueType: SETTING_VALUE_TYPE.INTEGER,
      isEditable: true,
    });
    await expect(service.setValue('badint', 1.5)).rejects.toBeInstanceOf(BusinessException);

    repo.findByKey.mockResolvedValue({
      key: 'badbool',
      value: 'true',
      valueType: SETTING_VALUE_TYPE.BOOLEAN,
      isEditable: true,
    });
    await expect(service.setValue('badbool', 'yes')).rejects.toBeInstanceOf(BusinessException);
  });
});