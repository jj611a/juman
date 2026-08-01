import { Body, Controller, Get, Headers, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ACCOUNT_UNLOCK_PERMISSION, AUTH_API_PREFIX } from '../core/auth.constants';
import { Public } from '../core/public.decorator';
import type { AuthPrincipal } from '../shared/types';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequirePermissions } from './decorators/require-permissions.decorator';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { UnlockAccountDto } from './dto/unlock-account.dto';
import { AuthService } from './services/auth.service';

@Controller(AUTH_API_PREFIX)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  login(@Body() body: LoginDto, @Req() req: Request) {
    return this.auth.login({
      username: body.username,
      password: body.password,
      rememberMe: body.rememberMe,
      deviceName: body.deviceName,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: AuthPrincipal) {
    await this.auth.logout(user);
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