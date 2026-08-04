import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  RequireAnyPermission,
  RequirePermissions,
} from '../auth/decorators/require-permissions.decorator';
import type { AuthPrincipal } from '../shared/types';
import {
  CreateSaleDto,
  ListSalesDto,
  SaleActionDto,
  SaleCompleteDto,
  SalePaymentDto,
} from './dto/sale.dto';
import { SALE_PERMISSION, SALE_PERMISSION_LEGACY } from './sales.constants';
import { SalesService } from './sales.service';

@Controller('sales')
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get()
  @RequireAnyPermission(SALE_PERMISSION.VIEW, SALE_PERMISSION_LEGACY.VIEW)
  list(@Query() query: ListSalesDto) {
    return this.sales.list(query);
  }

  @Get(':id/history')
  @RequireAnyPermission(SALE_PERMISSION.VIEW, SALE_PERMISSION_LEGACY.VIEW)
  history(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.history(id);
  }

  @Get(':id')
  @RequireAnyPermission(SALE_PERMISSION.VIEW, SALE_PERMISSION_LEGACY.VIEW)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.sales.getById(id);
  }

  @Post()
  @RequireAnyPermission(SALE_PERMISSION.CREATE, SALE_PERMISSION_LEGACY.CREATE)
  create(@Body() body: CreateSaleDto, @CurrentUser() user: AuthPrincipal) {
    return this.sales.create(body, user);
  }

  @Post(':id/confirm')
  @HttpCode(200)
  @RequireAnyPermission(
    SALE_PERMISSION.CREATE,
    SALE_PERMISSION.COMPLETE,
    SALE_PERMISSION_LEGACY.CREATE,
    SALE_PERMISSION_LEGACY.UPDATE,
  )
  confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SaleActionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.sales.confirm(id, body, user);
  }

  @Post(':id/payment')
  @HttpCode(200)
  @RequireAnyPermission(SALE_PERMISSION.PAYMENT, SALE_PERMISSION_LEGACY.UPDATE)
  payment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SalePaymentDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.sales.payment(id, body, user);
  }

  @Post(':id/complete')
  @HttpCode(200)
  @RequireAnyPermission(SALE_PERMISSION.COMPLETE, SALE_PERMISSION_LEGACY.UPDATE)
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SaleCompleteDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.sales.complete(id, body, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequireAnyPermission(SALE_PERMISSION.CANCEL, SALE_PERMISSION_LEGACY.CANCEL)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SaleActionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.sales.cancel(id, body?.reason, user);
  }
}
