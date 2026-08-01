import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import {
  REQUIRED_PERMISSIONS_KEY,
  REQUIRED_PERMISSIONS_MODE_KEY,
} from '../../core/auth.constants';
import type { AuthPrincipal } from '../../shared/types';
import type { PermissionMode } from '../decorators/require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const mode =
      this.reflector.getAllAndOverride<PermissionMode | undefined>(
        REQUIRED_PERMISSIONS_MODE_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? 'all';

    const request = context.switchToHttp().getRequest<Request & { user?: AuthPrincipal }>();
    const principal = request.user;
    if (!principal) {
      throw new ForbiddenException('Missing authenticated principal');
    }

    const granted = new Set(principal.permissions);
    const ok =
      mode === 'any'
        ? required.some((p) => granted.has(p))
        : required.every((p) => granted.has(p));

    if (!ok) {
      throw new ForbiddenException('Insufficient permissions');
    }
    return true;
  }
}
