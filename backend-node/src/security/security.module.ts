import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import type { AppConfig } from '../shared/types';
import { JwtTokenService } from './jwt-token.service';
import { LoginRateLimiterService } from './login-rate-limiter.service';
import { OpaqueTokenService } from './opaque-token.service';
import { PasswordHasherService } from './password-hasher.service';
import { PasswordPolicyService } from './password-policy.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const auth = config.getOrThrow<AppConfig>('app').auth;
        return {
          secret: auth.jwtSecret,
          signOptions: {
            issuer: auth.jwtIssuer,
            audience: auth.jwtAudience,
          },
        };
      },
    }),
  ],
  providers: [
    PasswordHasherService,
    PasswordPolicyService,
    JwtTokenService,
    OpaqueTokenService,
    LoginRateLimiterService,
  ],
  exports: [
    JwtModule,
    PasswordHasherService,
    PasswordPolicyService,
    JwtTokenService,
    OpaqueTokenService,
    LoginRateLimiterService,
  ],
})
export class SecurityModule {}
