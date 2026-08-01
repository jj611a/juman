import { Controller, Get, HttpCode, Post, Req, Body } from '@nestjs/common';
import type { Request } from 'express';
import { AUTH_API_PREFIX } from '../core/auth.constants';
import type { AuthPrincipal } from '../shared/types';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { AuthService } from './services/auth.service';

@Controller(`${AUTH_API_PREFIX}/auth`)
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /** Login placeholder surface — wired to AuthService foundation. */
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

  /** Logout current session. */
  @Post('logout')
  @HttpCode(200)
  async logout(@CurrentUser() user: AuthPrincipal) {
    await this.auth.logout(user);
    return { success: true, message: 'Logged out' };
  }

  @Public()
  @Post('refresh')
  @HttpCode(200)
  refresh(@Body() body: RefreshTokenDto) {
    return this.auth.refresh(body.refreshToken);
  }

  @Get('me')
  me(@CurrentUser() user: AuthPrincipal) {
    return {
      id: user.userId,
      username: user.username,
      fullName: user.fullName,
      roleId: user.roleId,
      roleName: user.roleName,
      mustChangePassword: user.mustChangePassword,
      permissions: user.permissions,
      sessionId: user.sessionId,
    };
  }
}
