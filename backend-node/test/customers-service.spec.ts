import 'reflect-metadata';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomersService } from '../src/customers/customers.service';
import { BusinessException } from '../src/shared/errors/business.exception';
import { CUSTOMER_NAME_MAX, CUSTOMER_STATUS } from '../src/customers/customers.constants';

describe('CustomersService', () => {
  const repo = {
    create: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findByNumber: vi.fn(),
    findAnyByNumber: vi.fn(),
    findActiveByPhoneNormalized: vi.fn(),
    nextSequence: vi.fn(),
    softDelete: vi.fn(),
    restore: vi.fn(),
    list: vi.fn(),
    sortFieldToOrder: vi.fn().mockReturnValue({ createdAt: 'desc' }),
  };
  const settings = {
    getString: vi.fn(async (_k: string, fb: string) => fb),
    getInt: vi.fn(async (_k: string, fb: number) => fb),
  };
  const audit = {
    recordCreate: vi.fn(),
    recordUpdate: vi.fn(),
    recordSoftDelete: vi.fn(),
    record: vi.fn(),
  };
  let service: CustomersService;

  const liveBase = {
    id: 'c1',
    customerNumber: 'CUS-00000001',
    fullName: 'علي',
    phone: '07701234567',
    phoneNormalized: '9647701234567',
    secondaryPhone: null,
    secondaryPhoneNormalized: null,
    address: null,
    city: 'بغداد',
    nationalId: null,
    gender: null,
    birthDate: null,
    notes: null,
    status: 'active',
    deletedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CustomersService(repo as never, settings as never, audit as never);
    repo.findActiveByPhoneNormalized.mockResolvedValue(null);
    repo.findAnyByNumber.mockResolvedValue(null);
    repo.nextSequence.mockResolvedValue(1);
    repo.create.mockImplementation(async (data: Record<string, unknown>) => ({
      id: 'c1',
      deletedAt: null,
      ...data,
    }));
    repo.list.mockResolvedValue({ rows: [liveBase], total: 1 });
  });

  it('creates customer with number and audits', async () => {
    const row = await service.create(
      {
        fullName: 'علي',
        phone: '07701234567',
        secondaryPhone: '07801234567',
        city: 'بغداد',
        address: '  ',
        notes: 'note',
        nationalId: '12345678',
        gender: 'male',
        birthDate: '1990-01-15',
        status: 'active',
      },
      { userId: 'u1', username: 'admin' } as never,
    );
    expect(row.customerNumber).toBe('CUS-00000001');
    expect(repo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        phoneNormalized: '9647701234567',
        secondaryPhoneNormalized: '9647801234567',
        city: 'بغداد',
        address: null,
        nationalId: '12345678',
        gender: 'MALE',
        status: CUSTOMER_STATUS.ACTIVE,
      }),
    );
    expect(audit.recordCreate).toHaveBeenCalled();
  });

  it('rejects duplicate active primary phone', async () => {
    repo.findActiveByPhoneNormalized.mockResolvedValue({ id: 'other' });
    await expect(
      service.create({ fullName: 'x', phone: '07701234567' }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('rejects oversized fullName', async () => {
    await expect(
      service.create({ fullName: 'x'.repeat(CUSTOMER_NAME_MAX + 1), phone: '07701234567' }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('skips colliding customer numbers then fails after retries', async () => {
    repo.findAnyByNumber.mockResolvedValueOnce({ id: 'clash' }).mockResolvedValue(null);
    repo.nextSequence.mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    const row = await service.create({ fullName: 'علي', phone: '07709998877' });
    expect(row.customerNumber).toBe('CUS-00000002');

    repo.findAnyByNumber.mockResolvedValue({ id: 'always' });
    await expect(
      service.create({ fullName: 'y', phone: '07709998866' }),
    ).rejects.toBeInstanceOf(BusinessException);
  });

  it('updates soft-deletes restores and lists', async () => {
    repo.findById.mockResolvedValue(liveBase);
    repo.update.mockResolvedValue({ ...liveBase, fullName: 'محمد' });
    await service.update(
      'c1',
      {
        fullName: 'محمد',
        phone: '07700001111',
        secondaryPhone: '',
        address: 'المنصور',
        city: 'بغداد',
        nationalId: null,
        gender: '',
        birthDate: '1988-05-01',
        notes: '  ',
        status: 'inactive',
      },
      { userId: 'u1' } as never,
    );
    expect(audit.recordUpdate).toHaveBeenCalled();
    expect(repo.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({
        phoneNormalized: '9647700001111',
        secondaryPhone: null,
        address: 'المنصور',
        gender: null,
        notes: null,
        status: 'inactive',
      }),
    );

    await service.update('c1', { clearBirthDate: true });
    expect(repo.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ birthDate: null }),
    );

    await service.update('c1', { birthDate: null });
    expect(repo.update).toHaveBeenCalledWith(
      'c1',
      expect.objectContaining({ birthDate: null }),
    );

    repo.softDelete.mockResolvedValue({ ...liveBase, deletedAt: new Date(), status: 'inactive' });
    await service.softDelete('c1', { userId: 'u1' } as never);

    repo.findById.mockResolvedValue({ ...liveBase, deletedAt: new Date() });
    repo.restore.mockResolvedValue({ ...liveBase, deletedAt: null, status: 'active' });
    await service.restore('c1', { userId: 'u1' } as never);
    expect(audit.record).toHaveBeenCalled();

    const page = await service.list({ q: 'علي', offset: 0, limit: 10 });
    expect(page.meta.total).toBe(1);

    await expect(service.search({})).rejects.toBeInstanceOf(BusinessException);
    const search = await service.search({ q: 'علي' });
    expect(search.items).toHaveLength(1);
  });

  it('lists with filters sorting and deleted flag', async () => {
    await service.list({
      status: 'active',
      city: 'بغداد',
      deleted: true,
      createdFrom: '2020-01-01',
      createdTo: '2030-01-01',
      updatedFrom: '2020-01-01',
      updatedTo: '2030-01-01',
      sortBy: 'phone',
      sortDir: 'asc',
      q: '770',
      offset: 0,
      limit: 20,
    });
    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: { not: null },
          status: 'active',
          city: { contains: 'بغداد' },
        }),
      }),
    );
    expect(repo.sortFieldToOrder).toHaveBeenCalledWith('phone', 'asc');
  });

  it('gets by id with optional view audit and by number', async () => {
    repo.findById.mockResolvedValue(liveBase);
    await service.getById('c1');
    expect(audit.record).not.toHaveBeenCalled();

    await service.getById('c1', { userId: 'u1', username: 'admin' } as never, {
      recordView: true,
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'view' }),
    );

    repo.findByNumber.mockResolvedValue(liveBase);
    await expect(service.getByNumber('CUS-00000001')).resolves.toEqual(liveBase);
  });

  it('validates national id gender birthDate status and restore conflicts', async () => {
    await expect(
      service.create({ fullName: 'x', phone: '07701234567', nationalId: 'abc' }),
    ).rejects.toBeInstanceOf(BusinessException);
    await expect(
      service.create({ fullName: 'x', phone: '07701234567', nationalId: '123' }),
    ).rejects.toBeInstanceOf(BusinessException);
    await expect(
      service.create({ fullName: 'x', phone: '07701234567', nationalId: '   ' }),
    ).resolves.toBeTruthy();
    await expect(
      service.create({ fullName: 'x', phone: '07701234568', gender: 'X' }),
    ).rejects.toBeInstanceOf(BusinessException);
    await expect(
      service.create({ fullName: 'x', phone: '07701234569', birthDate: '2999-01-01' }),
    ).rejects.toBeInstanceOf(BusinessException);
    await expect(
      service.create({ fullName: 'x', phone: '07701234560', birthDate: 'not-a-date' }),
    ).rejects.toBeInstanceOf(BusinessException);
    await expect(
      service.create({ fullName: 'x', phone: '07701234561', status: 'ghost' }),
    ).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue(null);
    await expect(service.getById('missing')).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue({ ...liveBase, deletedAt: null });
    await expect(service.restore('c1')).rejects.toBeInstanceOf(BusinessException);

    repo.findById.mockResolvedValue(null);
    await expect(service.restore('missing')).rejects.toBeInstanceOf(BusinessException);

    repo.findByNumber.mockResolvedValue(null);
    await expect(service.getByNumber('CUS-9')).rejects.toBeInstanceOf(BusinessException);
  });
});
