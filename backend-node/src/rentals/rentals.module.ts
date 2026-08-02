import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { CustomersModule } from '../customers/customers.module';
import { FinanceModule } from '../finance/finance.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RentalsController } from './rentals.controller';
import { RentalsRepository } from './rentals.repository';
import { RentalsService } from './rentals.service';

@Module({
  imports: [
    CustomersModule,
    InventoryModule,
    AvailabilityModule,
    FinanceModule,
  ],
  controllers: [RentalsController],
  providers: [RentalsRepository, RentalsService],
  exports: [RentalsService],
})
export class RentalsModule {}
