import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { RolesModule } from '../roles/roles.module';
import { SecurityModule } from '../security/security.module';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AdminBootstrapService } from './bootstrap/admin-bootstrap.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { PasswordChangeGuard } from './guards/password-change.guard';
import { PermissionsGuard } from './guards/permissions.guard';
import { AuthService } from './services/auth.service';
import { LoginHistoryService } from './services/login-history.service';
import { RefreshTokenService } from './services/refresh-token.service';
import { SessionService } from './services/session.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    SecurityModule,
    UsersModule,
    RolesModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    RefreshTokenService,
    LoginHistoryService,
    JwtStrategy,
    PermissionsGuard,
    AdminBootstrapService,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
  ],
  exports: [AuthService, SessionService, RefreshTokenService, PermissionsGuard],
})
export class AuthModule {}
