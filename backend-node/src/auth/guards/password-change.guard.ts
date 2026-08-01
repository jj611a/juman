import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../core/auth.constants';
import type { AuthPrincipal } from '../../shared/types';
import { AuthService } from '../services/auth.service';

@Injectable()
export class PasswordChangeGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & { user?: AuthPrincipal }>();
    if (!request.user) return true;

    this.auth.assertPasswordChangeAllowed(request.user, request.path);
    return true;
  }
}
