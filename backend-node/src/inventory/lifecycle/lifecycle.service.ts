import { Injectable } from '@nestjs/common';
import { AuditService } from '../../audit/audit.service';
import { AUDIT_ACTION } from '../../shared/constants/business.constants';
import { BusinessException } from '../../shared/errors/business.exception';
import {
  normalizePagination,
  paginated,
  type Paginated,
  type PaginationInput,
} from '../../shared/pagination/pagination';
import { assertNonEmptyString } from '../../shared/validation/assert';
import type { AuthPrincipal } from '../../shared/types';
import {
  INVENTORY_MODULE,
  ITEM_ENTITY,
  ITEM_LIFECYCLE_DEFAULT,
  ITEM_STATUS,
  type ItemLifecycleState,
} from '../inventory.constants';
import { LifecycleRepository } from './lifecycle.repository';
import {
  canTransitionStates,
  isEditable,
  isLifecycleState,
  isOperational,
  isRentable,
  isSellable,
} from './lifecycle.rules';

export interface TransitionInput {
  readonly newState: string;
  readonly reason?: string | null;
  readonly referenceType?: string | null;
  readonly referenceId?: string | null;
  /** Optional optimistic concurrency — must match current state when provided. */
  readonly expectedState?: string | null;
}

@Injectable()
export class LifecycleService {
  constructor(
    private readonly repo: LifecycleRepository,
    private readonly audit: AuditService,
  ) {}

  async currentState(itemId: string) {
    const item = await this.requireLive(itemId);
    return this.toStateView(item);
  }

  async history(
    itemId: string,
    query: PaginationInput = {},
  ): Promise<Paginated<{
    id: string;
    oldState: string;
    newState: string;
    reason: string | null;
    userId: string | null;
    username: string | null;
    referenceType: string | null;
    referenceId: string | null;
    createdAt: Date;
  }>> {
    await this.requireLive(itemId);
    const page = normalizePagination(query);
    const { rows, total } = await this.repo.history(
      itemId,
      page.offset,
      page.limit,
    );
    return paginated(
      rows.map((r) => ({
        id: r.id,
        oldState: r.oldState,
        newState: r.newState,
        reason: r.reason,
        userId: r.userId,
        username: r.username,
        referenceType: r.referenceType,
        referenceId: r.referenceId,
        createdAt: r.createdAt,
      })),
      total,
      page,
    );
  }

  canTransition(fromRaw: string, toRaw: string): boolean {
    if (!isLifecycleState(fromRaw) || !isLifecycleState(toRaw)) return false;
    return canTransitionStates(fromRaw, toRaw);
  }

  async transition(
    itemId: string,
    input: TransitionInput,
    actor?: AuthPrincipal,
  ) {
    const item = await this.requireLive(itemId);
    if (
      item.status === ITEM_STATUS.ARCHIVED ||
      item.status === ITEM_STATUS.RETIRED
    ) {
      throw BusinessException.conflict(
        'Cannot transition lifecycle for archived or catalog-retired items',
      );
    }

    const from = this.parseState(item.lifecycleState);
    const to = this.parseState(input.newState);

    if (input.expectedState != null && input.expectedState !== '') {
      const expected = this.parseState(input.expectedState);
      if (expected !== from) {
        throw BusinessException.conflict(
          `Lifecycle state changed (expected ${expected}, current ${from})`,
        );
      }
    }

    if (from === to) {
      throw BusinessException.validation(
        `Item is already in lifecycle state ${to}`,
      );
    }
    if (!canTransitionStates(from, to)) {
      throw BusinessException.conflict(
        `Invalid lifecycle transition: ${from} → ${to}`,
      );
    }

    const reason =
      input.reason == null || String(input.reason).trim() === ''
        ? null
        : String(input.reason).trim().slice(0, 500);

    const result = await this.repo.transitionAtomic({
      itemId,
      from,
      to,
      reason,
      userId: actor?.userId ?? null,
      username: actor?.username ?? null,
      referenceType:
        input.referenceType == null || String(input.referenceType).trim() === ''
          ? null
          : String(input.referenceType).trim().toLowerCase().slice(0, 64),
      referenceId:
        input.referenceId == null || String(input.referenceId).trim() === ''
          ? null
          : String(input.referenceId).trim().slice(0, 64),
      updatedBy: actor?.userId ?? null,
    });

    if (!result) {
      throw BusinessException.conflict(
        'Concurrent lifecycle transition rejected',
      );
    }

    await this.audit.record({
      module: INVENTORY_MODULE,
      entityType: ITEM_ENTITY,
      entityId: itemId,
      action: AUDIT_ACTION.TRANSITION,
      oldValues: { lifecycleState: from },
      newValues: {
        lifecycleState: to,
        reason,
        referenceType: result.history.referenceType,
        referenceId: result.history.referenceId,
      },
      actor: { userId: actor?.userId, username: actor?.username },
    });

    return this.toStateView(result.item);
  }

  /** Seed birth history when an item is first created. */
  async recordCreated(itemId: string, actor?: AuthPrincipal): Promise<void> {
    await this.repo.createHistory({
      itemId,
      oldState: ITEM_LIFECYCLE_DEFAULT,
      newState: ITEM_LIFECYCLE_DEFAULT,
      reason: 'created',
      userId: actor?.userId ?? null,
      username: actor?.username ?? null,
      referenceType: null,
      referenceId: null,
    });
  }

  private parseState(raw: string): ItemLifecycleState {
    const value = assertNonEmptyString(raw, 'lifecycleState').toLowerCase();
    if (!isLifecycleState(value)) {
      throw BusinessException.validation(`Unsupported lifecycle state: ${raw}`);
    }
    return value;
  }

  private async requireLive(itemId: string) {
    const id = assertNonEmptyString(itemId, 'itemId');
    const item = await this.repo.findLiveItem(id);
    if (!item) throw BusinessException.notFound('Item not found');
    return item;
  }

  private toStateView(item: {
    id: string;
    lifecycleState: string;
    status: string;
    deletedAt: Date | null;
    updatedAt: Date;
  }) {
    const flags = {
      deletedAt: item.deletedAt,
      status: item.status,
      lifecycleState: item.lifecycleState,
    };
    return {
      itemId: item.id,
      lifecycleState: item.lifecycleState,
      catalogStatus: item.status,
      isOperational: isOperational(flags),
      isRentable: isRentable(flags),
      isSellable: isSellable(flags),
      isEditable: isEditable(flags),
      updatedAt: item.updatedAt,
    };
  }
}
