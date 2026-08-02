import { Module } from '@nestjs/common';
import { AvailabilityModule } from '../availability/availability.module';
import { CustomersModule } from '../customers/customers.module';
import { InventoryModule } from '../inventory/inventory.module';
import { RentalsModule } from '../rentals/rentals.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsRepository } from './reservations.repository';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [
    CustomersModule,
    InventoryModule,
    RentalsModule,
    AvailabilityModule,
  ],
  controllers: [ReservationsController],
  providers: [ReservationsRepository, ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
