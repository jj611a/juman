import {
  ITEM_LIFECYCLE,
  ITEM_LIFECYCLE_TRANSITIONS,
  ITEM_LIFECYCLE_VALUES,
  ITEM_STATUS,
  type ItemLifecycleState,
} from '../inventory.constants';

export function isLifecycleState(value: string): value is ItemLifecycleState {
  return (ITEM_LIFECYCLE_VALUES as string[]).includes(value);
}

export function normalizeLifecycleState(raw: string): ItemLifecycleState {
  const value = raw.trim().toLowerCase();
  if (!isLifecycleState(value)) {
    throw new Error(`Unsupported lifecycle state: ${raw}`);
  }
  return value;
}

export function allowedTargets(from: ItemLifecycleState): readonly ItemLifecycleState[] {
  return ITEM_LIFECYCLE_TRANSITIONS[from];
}

export function canTransitionStates(
  from: ItemLifecycleState,
  to: ItemLifecycleState,
): boolean {
  return allowedTargets(from).includes(to);
}

/** Soft-deleted or terminal catalog statuses are not operational. */
export function isOperational(input: {
  deletedAt: Date | null;
  status: string;
  lifecycleState: string;
}): boolean {
  if (input.deletedAt) return false;
  if (input.status !== ITEM_STATUS.ACTIVE && input.status !== ITEM_STATUS.DRAFT) {
    return false;
  }
  return (
    input.lifecycleState !== ITEM_LIFECYCLE.RETIRED &&
    input.lifecycleState !== ITEM_LIFECYCLE.SOLD &&
    input.lifecycleState !== ITEM_LIFECYCLE.LOST
  );
}

export function isRentable(input: {
  deletedAt: Date | null;
  status: string;
  lifecycleState: string;
}): boolean {
  return (
    input.deletedAt == null &&
    input.status === ITEM_STATUS.ACTIVE &&
    input.lifecycleState === ITEM_LIFECYCLE.AVAILABLE
  );
}

export function isSellable(input: {
  deletedAt: Date | null;
  status: string;
  lifecycleState: string;
}): boolean {
  if (input.deletedAt != null || input.status !== ITEM_STATUS.ACTIVE) return false;
  return (
    input.lifecycleState === ITEM_LIFECYCLE.AVAILABLE ||
    input.lifecycleState === ITEM_LIFECYCLE.FOR_SALE
  );
}

/** Catalog field edits allowed when not mid-rental/sale flow. */
export function isEditable(input: {
  deletedAt: Date | null;
  status: string;
  lifecycleState: string;
}): boolean {
  if (input.deletedAt != null) return false;
  if (
    input.status === ITEM_STATUS.ARCHIVED ||
    input.status === ITEM_STATUS.RETIRED
  ) {
    return false;
  }
  return (
    input.lifecycleState === ITEM_LIFECYCLE.AVAILABLE ||
    input.lifecycleState === ITEM_LIFECYCLE.MAINTENANCE ||
    input.lifecycleState === ITEM_LIFECYCLE.FOR_SALE ||
    input.lifecycleState === ITEM_LIFECYCLE.DAMAGED
  );
}
