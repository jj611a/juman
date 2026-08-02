import { describe, expect, it, vi, beforeEach } from 'vitest';
import { LifecycleService } from '../src/inventory/lifecycle/lifecycle.service';
import { BusinessException } from '../src/shared/errors/business.exception';
import {
  canTransitionStates,
  isEditable,
  isOperational,
  isRentable,
  isSellable,
} from '../src/inventory/lifecycle/lifecycle.rules';
import { ITEM_LIFECYCLE, ITEM_STATUS } from '../src/inventory/inventory.constants';
import { LifecycleController } from '../src/inventory/lifecycle/lifecycle.controller';
import { LifecycleRepository } from '../src/inventory/lifecycle/lifecycle.repository';

describe('lifecycle.rules', () => {
  it('allows happy-path rental cycle and rejects invalid edges', () => {
    expect(canTransitionStates(ITEM_LIFECYCLE.AVAILABLE, ITEM_LIFECYCLE.RESERVED)).toBe(true);
    expect(canTransitionStates(ITEM_LIFECYCLE.RESERVED, ITEM_LIFECYCLE.RENTED)).toBe(true);
    expect(canTransitionStates(ITEM_LIFECYCLE.RENTED, ITEM_LIFECYCLE.RETURN_PENDING)).toBe(true);
    expect(canTransitionStates(ITEM_LIFECYCLE.RETURN_PENDING, ITEM_LIFECYCLE.INSPECTION)).toBe(true);
    expect(canTransitionStates(ITEM_LIFECYCLE.INSPECTION, ITEM_LIFECYCLE.CLEANING)).toBe(true);
    expect(canTransitionStates(ITEM_LIFECYCLE.CLEANING, ITEM_LIFECYCLE.AVAILABLE)).toBe(true);
    expect(canTransitionStates(ITEM_LIFECYCLE.AVAILABLE, ITEM_LIFECYCLE.RENTED)).toBe(false);
    expect(canTransitionStates(ITEM_LIFECYCLE.RETIRED, ITEM_LIFECYCLE.AVAILABLE)).toBe(false);
    expect(canTransitionStates(ITEM_LIFECYCLE.AVAILABLE, ITEM_LIFECYCLE.LOST)).toBe(true);
    expect(canTransitionStates(ITEM_LIFECYCLE.DAMAGED, ITEM_LIFECYCLE.MAINTENANCE)).toBe(true);
  });

  it('computes availability flags from lifecycle + catalog status', () => {
    const available = {
      deletedAt: null,
      status: ITEM_STATUS.ACTIVE,
      lifecycleState: ITEM_LIFECYCLE.AVAILABLE,
    };
    expect(isOperational(available)).toBe(true);
    expect(isRentable(available)).toBe(true);
    expect(isSellable(available)).toBe(true);
    expect(isEditable(available)).toBe(true);

    const rented = { ...available, lifecycleState: ITEM_LIFECYCLE.RENTED };
    expect(isRentable(rented)).toBe(false);
    expect(isEditable(rented)).toBe(false);
    expect(isOperational(rented)).toBe(true);

    const sold = { ...available, lifecycleState: ITEM_LIFECYCLE.SOLD };
    expect(isOperational(sold)).toBe(false);
    expect(isSellable(sold)).toBe(false);

    expect(
      isOperational({
        deletedAt: new Date(),
        status: ITEM_STATUS.ACTIVE,
        lifecycleState: ITEM_LIFECYCLE.AVAILABLE,
      }),
    ).toBe(false);
    expect(
      isOperational({
        deletedAt: null,
        status: ITEM_STATUS.DRAFT,
        lifecycleState: ITEM_LIFECYCLE.AVAILABLE,
      }),
    ).toBe(true);
    expect(
      isOperational({
        deletedAt: null,
        status: ITEM_STATUS.INACTIVE,
        lifecycleState: ITEM_LIFECYCLE.AVAILABLE,
      }),
    ).toBe(false);
    expect(
      isSellable({
        deletedAt: null,
        status: ITEM_STATUS.ACTIVE,
        lifecycleState: ITEM_LIFECYCLE.FOR_SALE,
      }),
    ).toBe(true);
    expect(
      isEditable({
        deletedAt: null,
        status: ITEM_STATUS.ARCHIVED,
        lifecycleState: ITEM_LIFECYCLE.AVAILABLE,
      }),
    ).toBe(false);
    expect(
      isEditable({
        deletedAt: null,
        status: ITEM_STATUS.ACTIVE,
        lifecycleState: ITEM_LIFECYCLE.MAINTENANCE,
      }),
    ).toBe(true);
  });

  it('normalizes lifecycle state strings', async () => {
    const { normalizeLifecycleState, isLifecycleState } = await import(
      '../src/inventory/lifecycle/lifecycle.rules'
    );
    expect(isLifecycleState('available')).toBe(true);
    expect(isLifecycleState('nope')).toBe(false);
    expect(normalizeLifecycleState(' AVAILABLE ')).toBe('available');
    expect(() => normalizeLifecycleState('nope')).toThrow();
  });
});

describe('LifecycleService', () => {
  const repo = {
    findLiveItem: vi.fn(),
    history: vi.fn(),
    transitionAtomic: vi.fn(),
    createHistory: vi.fn(),
  };
  const audit = { record: vi.fn() };
  let service: LifecycleService;

  const item = {
    id: 'i1',
    lifecycleState: ITEM_LIFECYCLE.AVAILABLE,
    status: ITEM_STATUS.ACTIVE,
    deletedAt: null,
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    service = new LifecycleService(repo as never, audit as never);
    repo.findLiveItem.mockResolvedValue(item);
    repo.transitionAtomic.mockResolvedValue({
      item: { ...item, lifecycleState: ITEM_LIFECYCLE.RESERVED },
      history: {
        id: 'h1',
        oldState: ITEM_LIFECYCLE.AVAILABLE,
        newState: ITEM_LIFECYCLE.RESERVED,
        reason: 'hold',
        referenceType: null,
        referenceId: null,
      },
    });
    repo.history.mockResolvedValue({
      rows: [
        {
          id: 'h1',
          oldState: 'available',
          newState: 'reserved',
          reason: 'hold',
          userId: 'u1',
          username: 'admin',
          referenceType: null,
          referenceId: null,
          createdAt: new Date(),
        },
      ],
      total: 1,
    });
  });

  it('transitions validates and rejects invalid / concurrent changes', async () => {
    const view = await service.transition(
      'i1',
      { newState: ITEM_LIFECYCLE.RESERVED, reason: 'hold' },
      { userId: 'u1', username: 'admin' } as never,
    );
    expect(view.lifecycleState).toBe(ITEM_LIFECYCLE.RESERVED);
    expect(view.isRentable).toBe(false);
    expect(audit.record).toHaveBeenCalled();

    await expect(
      service.transition('i1', { newState: ITEM_LIFECYCLE.RENTED }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.transition('i1', {
        newState: ITEM_LIFECYCLE.RESERVED,
        expectedState: ITEM_LIFECYCLE.RENTED,
      }),
    ).rejects.toBeInstanceOf(BusinessException);

    await expect(
      service.transition('i1', { newState: ITEM_LIFECYCLE.AVAILABLE }),
    ).rejects.toBeInstanceOf(BusinessException);

    repo.transitionAtomic.mockResolvedValueOnce(null);
    await expect(
      service.transition('i1', { newState: ITEM_LIFECYCLE.RESERVED }),
    ).rejects.toBeInstanceOf(BusinessException);

    expect(service.canTransition(ITEM_LIFECYCLE.AVAILABLE, ITEM_LIFECYCLE.RESERVED)).toBe(true);
    expect(service.canTransition('nope', ITEM_LIFECYCLE.RESERVED)).toBe(false);
  });

  it('returns current state and history', async () => {
    const state = await service.currentState('i1');
    expect(state.isRentable).toBe(true);
    const hist = await service.history('i1', { offset: 0, limit: 10 });
    expect(hist.meta.total).toBe(1);
    await service.recordCreated('i1', { userId: 'u1' } as never);
    expect(repo.createHistory).toHaveBeenCalled();
  });

  it('blocks transitions for archived catalog items and bad state tokens', async () => {
    repo.findLiveItem.mockResolvedValue({
      ...item,
      status: ITEM_STATUS.ARCHIVED,
    });
    await expect(
      service.transition('i1', { newState: ITEM_LIFECYCLE.RESERVED }),
    ).rejects.toBeInstanceOf(BusinessException);

    repo.findLiveItem.mockResolvedValue(item);
    await expect(
      service.transition('i1', { newState: 'not-a-state' }),
    ).rejects.toBeInstanceOf(BusinessException);

    repo.findLiveItem.mockResolvedValue(null);
    await expect(service.currentState('missing')).rejects.toBeInstanceOf(BusinessException);
  });
});

describe('LifecycleController + Repository', () => {
  it('delegates HTTP and covers repository CAS paths', async () => {
    const lifecycle = {
      currentState: vi.fn(),
      history: vi.fn(),
      transition: vi.fn(),
    };
    const controller = new LifecycleController(lifecycle as never);
    await controller.state('i1');
    await controller.history('i1', { offset: 0, limit: 20 });
    await controller.transition(
      'i1',
      { newState: 'reserved' } as never,
      { userId: 'u' } as never,
    );
    expect(lifecycle.transition).toHaveBeenCalled();

    const prisma = {
      item: {
        findFirst: vi.fn().mockResolvedValue({ id: 'i1' }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'i1', lifecycleState: 'reserved' }),
      },
      itemStateHistory: {
        findMany: vi.fn().mockResolvedValue([]),
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue({ id: 'h1' }),
      },
      $transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
        fn({
          item: prisma.item,
          itemStateHistory: prisma.itemStateHistory,
        }),
      ),
    };
    const repo = new LifecycleRepository(prisma as never);
    await repo.findLiveItem('i1');
    await repo.history('i1', 0, 10);
    expect(
      await repo.transitionAtomic({
        itemId: 'i1',
        from: 'available',
        to: 'reserved',
        reason: null,
        userId: null,
        username: null,
        referenceType: null,
        referenceId: null,
        updatedBy: null,
      }),
    ).not.toBeNull();
    prisma.item.updateMany.mockResolvedValueOnce({ count: 0 });
    expect(
      await repo.transitionAtomic({
        itemId: 'i1',
        from: 'available',
        to: 'reserved',
        reason: null,
        userId: null,
        username: null,
        referenceType: null,
        referenceId: null,
        updatedBy: null,
      }),
    ).toBeNull();
    await repo.createHistory({
      itemId: 'i1',
      oldState: 'available',
      newState: 'available',
      reason: 'created',
    });
  });
});
