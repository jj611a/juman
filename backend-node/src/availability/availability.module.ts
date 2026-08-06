import { Global, Module } from '@nestjs/common';
import { AvailabilityService } from './availability.service';
import { AvailabilityController } from './availability.controller';

/**
 * Shared allocation / conflict detection.
 * Imported by Rentals and Reservations — never duplicate overlap logic elsewhere.
 */
@Global()
@Module({
  controllers: [AvailabilityController],
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
