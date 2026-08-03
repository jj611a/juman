import { Module } from '@nestjs/common';
import { ReportExportRegistry } from './export/export.registry';
import { ReportsController } from './reports.controller';
import { ReportsRepository } from './reports.repository';
import { ReportsService } from './reports.service';

/**
 * Read-only reporting bounded context.
 * Reads Inventory / Rental / Settlement / Finance tables via Prisma aggregates.
 * Never imports or calls domain write services.
 */
@Module({
  controllers: [ReportsController],
  providers: [ReportsRepository, ReportsService, ReportExportRegistry],
  exports: [ReportsService],
})
export class ReportsModule {}
