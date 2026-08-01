import { applyDecorators, SetMetadata } from '@nestjs/common';
import {
  REQUIRED_PERMISSIONS_KEY,
  REQUIRED_PERMISSIONS_MODE_KEY,
} from '../../core/auth.constants';

export type PermissionMode = 'all' | 'any';

export const RequirePermissions = (...permissions: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions);

export function RequireAnyPermission(...permissions: string[]) {
  return applyDecorators(
    SetMetadata(REQUIRED_PERMISSIONS_KEY, permissions),
    SetMetadata(REQUIRED_PERMISSIONS_MODE_KEY, 'any' as PermissionMode),
  );
}
