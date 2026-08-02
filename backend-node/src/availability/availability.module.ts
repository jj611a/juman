import { Global, Module } from '@nestjs/common';
import { AvailabilityService } from './availability.service';

/**
 * Shared allocation / conflict detection.
 * Imported by Rentals and Reservations — never duplicate overlap logic elsewhere.
 */
@Global()
@Module({
  providers: [AvailabilityService],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
