import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ACCOUNT_UNLOCK_PERMISSION, AUTH_API_PREFIX } from '../core/auth.constants';
import { Public } from '../core/public.decorator';
import { LoginRateLimiterService } from '../security/login-rate-limiter.service';
import type { AuthPrincipal } from '../shared/types';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequirePermissions } from './decorators/require-permissions.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UnlockAccountDto } from './dto/unlock-account.dto';
import { AuthService } from './services/auth.service';

@Controller(AUTH_API_PREFIX)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly rateLimiter: LoginRateLimiterService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto, @Req() req: Request) {
    const decision = this.rateLimiter.consume(req.ip ?? 'unknown', body.username);
    if (!decision.allowed) {
      throw new HttpException(
        {
          message: 'Too many login attempts. Please try again later.',
          error: 'Too Many Requests',
          code: 'rate_limit',
          retryAfterMs: decision.retryAfterMs,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return this.auth.login({
      username: body.username,
      password: body.password,
      rememberMe: body.rememberMe,
      deviceName: body.deviceName,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  /**
   * Public so logout always succeeds — including when the access token has
   * already expired. Prefers the refresh token (long-lived, can always be
   * revoked); falls back to the access token when present.
   */
  @Public()
  @Post('logout')
  @HttpCode(200)
  async logout(
    @Headers('authorization') authorization?: string,
    @Headers('x-refresh-token') refreshToken?: string,
  ) {
    if (refreshToken) {
      await this.auth.logoutWithRefreshToken(refreshToken);
      return { success: true, message: 'Logged out' };
    }
    const accessToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;
    if (accessToken) {
      await this.auth.logoutWithAccessToken(accessToken);
    }
    return { success: true, message: 'Logged out' };
  }

  @Post('change-password')
  @HttpCode(200)
  async changePassword(
    @CurrentUser() user: AuthPrincipal,
    @Body() body: ChangePasswordDto,
  ) {
    await this.auth.changePassword(user, body.currentPassword, body.newPassword);
    return { success: true, message: 'Password changed' };
  }

  /**
   * Administrator recovery for timed/permanent lockouts.
   * Requires users.unlock. See README for timed wait and emergency SQLite recovery.
   */
  @Post('admin/unlock')
  @HttpCode(200)
  @RequirePermissions(ACCOUNT_UNLOCK_PERMISSION)
  async unlock(@Body() body: UnlockAccountDto) {
    const result = await this.auth.unlockByUsername(body.username);
    return { success: true, ...result };
  }

  /**
   * Session restore for Electron Main.
   * Bearer access token preferred. Optional X-Refresh-Token for cold restore (Remember Me).
   */
  @Public()
  @Get('session')
  async session(
    @Headers('authorization') authorization?: string,
    @Headers('x-refresh-token') refreshToken?: string,
  ) {
    const accessToken = authorization?.startsWith('Bearer ')
      ? authorization.slice('Bearer '.length).trim()
      : undefined;
    return this.auth.restoreSession({ accessToken, refreshToken });
  }

  @Get('me')
  me(@CurrentUser() user: AuthPrincipal) {
    return this.auth.getMe(user);
  }
}