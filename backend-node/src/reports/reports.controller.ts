import {
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Query,
  StreamableFile,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthPrincipal } from '../shared/types';
import {
  ReportExportQueryDto,
  ReportQueryDto,
} from './dto/report-query.dto';
import { REPORT_PERMISSION } from './reports.constants';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('dashboard')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  dashboard() {
    return this.reports.dashboard();
  }

  @Get('financial')
  @RequirePermissions(REPORT_PERMISSION.FINANCIAL_VIEW)
  financial(@Query() query: ReportQueryDto) {
    return this.reports.financial(query);
  }

  @Get('rentals/current')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  rentalsCurrent(@Query() query: ReportQueryDto) {
    return this.reports.rentalsCurrent(query);
  }

  @Get('rentals/overdue')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  rentalsOverdue(@Query() query: ReportQueryDto) {
    return this.reports.rentalsOverdue(query);
  }

  @Get('rentals/returns')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  rentalsReturns(@Query() query: ReportQueryDto) {
    return this.reports.rentalsReturns(query);
  }

  @Get('rentals/reservations')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  rentalsReservations(@Query() query: ReportQueryDto) {
    return this.reports.rentalsReservations(query);
  }

  @Get('rentals/history')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  rentalsHistory(@Query() query: ReportQueryDto) {
    return this.reports.rentalsHistory(query);
  }

  @Get('inventory/value')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  inventoryValue(@Query() query: ReportQueryDto) {
    return this.reports.inventoryValue(query);
  }

  @Get('inventory/availability')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  inventoryAvailability() {
    return this.reports.inventoryAvailability();
  }

  @Get('inventory/category')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  inventoryCategory() {
    return this.reports.inventoryCategory();
  }

  @Get('inventory/brand')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  inventoryBrand() {
    return this.reports.inventoryBrand();
  }

  @Get('inventory/color')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  inventoryColor() {
    return this.reports.inventoryColor();
  }

  @Get('inventory/size')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  inventorySize() {
    return this.reports.inventorySize();
  }

  @Get('inventory/lifecycle')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  inventoryLifecycle() {
    return this.reports.inventoryLifecycle();
  }

  @Get('inventory/retired')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  inventoryRetired(@Query() query: ReportQueryDto) {
    return this.reports.inventoryRetired(query);
  }

  @Get('inventory/maintenance')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  inventoryMaintenance(@Query() query: ReportQueryDto) {
    return this.reports.inventoryMaintenance(query);
  }

  @Get('customers/:id/rentals')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  customerRentals(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.customerRentals(id, query);
  }

  @Get('customers/:id/outstanding')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  customerOutstanding(@Param('id', ParseUUIDPipe) id: string) {
    return this.reports.customerOutstanding(id);
  }

  @Get('customers/:id/payments')
  @RequirePermissions(REPORT_PERMISSION.FINANCIAL_VIEW)
  customerPayments(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.customerPayments(id, query);
  }

  @Get('customers/:id/reservations')
  @RequirePermissions(REPORT_PERMISSION.VIEW)
  customerReservations(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ReportQueryDto,
  ) {
    return this.reports.customerReservations(id, query);
  }

  @Get('export')
  @RequirePermissions(REPORT_PERMISSION.EXPORT)
  @Header('X-Content-Type-Options', 'nosniff')
  async export(
    @Query() query: ReportExportQueryDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    const result = await this.reports.export(query, user);
    const body =
      typeof result.body === 'string'
        ? Buffer.from(result.body, 'utf8')
        : result.body;
    return new StreamableFile(body, {
      type: result.contentType,
      disposition: `attachment; filename="${result.filename}"`,
    });
  }
}
