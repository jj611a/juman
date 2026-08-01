import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthPrincipal } from '../../shared/types';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AuthPrincipal }>();
    if (!request.user) {
      throw new Error('CurrentUser used without authenticated principal');
    }
    return request.user;
  },
);
