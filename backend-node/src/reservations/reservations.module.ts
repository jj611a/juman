import { Module } from '@nestjs/common';
import { CustomersModule } from '../customers/customers.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RentalsModule } from '../rentals/rentals.module';
import { AvailabilityService } from './availability/availability.service';
import { ReservationsController } from './reservations.controller';
import { ReservationsRepository } from './reservations.repository';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [CustomersModule, InventoryModule, RentalsModule],
  controllers: [ReservationsController],
  providers: [ReservationsRepository, ReservationsService, AvailabilityService],
  exports: [ReservationsService, AvailabilityService],
})
export class ReservationsModule {}
