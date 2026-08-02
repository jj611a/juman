import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { CustomersModule } from '../customers/customers.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RentalsController } from './rentals.controller';
import { RentalsRepository } from './rentals.repository';
import { RentalsService } from './rentals.service';

@Module({
  imports: [CustomersModule, InventoryModule, AvailabilityModule],
  controllers: [RentalsController],
  providers: [RentalsRepository, RentalsService],
  exports: [RentalsService],
})
export class RentalsModule {}
