import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { PasswordChangeGuard } from './auth/guards/password-change.guard';
import { PermissionsGuard } from './auth/guards/permissions.guard';
import { AvailabilityModule } from './availability/availability.module';
import { BarcodeModule } from './barcode/barcode.module';
import { configuration } from './config/configuration';
import { validateEnvironment } from './config/env.validation';
import { CustomersModule } from './customers/customers.module';
import { PrismaModule } from './database/prisma.module';
import { FinanceModule } from './finance/finance.module';
import { HealthModule } from './health/health.module';
import { InventoryModule } from './inventory/inventory.module';
import { LoggerModule } from './logging/logger.module';
import { MediaModule } from './media/media.module';
import { PermissionsModule } from './permissions/permissions.module';
import { RentalsModule } from './rentals/rentals.module';
import { ReportsModule } from './reports/reports.module';
import { ReservationsModule } from './reservations/reservations.module';
import { RolesModule } from './roles/roles.module';
import { SalesModule } from './sales/sales.module';
import { SettingsModule } from './settings/settings.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    LoggerModule,
    PrismaModule,
    SettingsModule,
    AuditModule,
    MediaModule,
    BarcodeModule,
    PermissionsModule,
    RolesModule,
    UsersModule,
    AuthModule,
    CustomersModule,
    InventoryModule,
    AvailabilityModule,
    FinanceModule,
    RentalsModule,
    ReservationsModule,
    SalesModule,
    ReportsModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
  ],
})
export class AppModule {}
