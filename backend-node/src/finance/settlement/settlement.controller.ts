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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import type { AuthPrincipal } from '../../shared/types';
import {
  ListSettlementsDto,
  SettlementActionDto,
  SettlementPaymentDto,
} from './dto/settlement.dto';
import {
  SettlementAdjustmentDto,
  SettlementDiscountDto,
  SettlementLateFeeDto,
  SettlementRefundDto,
} from './dto/settlement-modifiers.dto';
import { FINANCE_PERMISSION } from '../finance.constants';
import { SETTLEMENT_PERMISSION } from './settlement.constants';
import { SettlementService } from './settlement.service';

@Controller('settlements')
export class SettlementController {
  constructor(private readonly settlements: SettlementService) {}

  @Get()
  @RequirePermissions(SETTLEMENT_PERMISSION.VIEW)
  list(@Query() query: ListSettlementsDto) {
    return this.settlements.list(query);
  }

  @Get(':id')
  @RequirePermissions(SETTLEMENT_PERMISSION.VIEW)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.settlements.getById(id);
  }

  @Post(':id/payment')
  @HttpCode(200)
  @RequirePermissions(SETTLEMENT_PERMISSION.MANAGE)
  applyPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SettlementPaymentDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.settlements.applyPayment(id, body, user);
  }

  @Post(':id/refund')
  @HttpCode(200)
  @RequirePermissions(SETTLEMENT_PERMISSION.MANAGE)
  applyRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SettlementRefundDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.settlements.applyRefund(id, body, user);
  }

  @Post(':id/adjustment')
  @HttpCode(200)
  @RequirePermissions(FINANCE_PERMISSION.ADJUSTMENT)
  applyAdjustment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SettlementAdjustmentDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.settlements.applyAdjustment(id, body, user);
  }

  @Post(':id/discount')
  @HttpCode(200)
  @RequirePermissions(SETTLEMENT_PERMISSION.MANAGE)
  applyDiscount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SettlementDiscountDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.settlements.applyDiscount(id, body, user);
  }

  @Post(':id/late-fee')
  @HttpCode(200)
  @RequirePermissions(SETTLEMENT_PERMISSION.MANAGE)
  assessLateFee(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SettlementLateFeeDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.settlements.assessLateFee(id, body, user);
  }

  @Post(':id/close')
  @HttpCode(200)
  @RequirePermissions(SETTLEMENT_PERMISSION.MANAGE)
  close(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SettlementActionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.settlements.close(id, body, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions(SETTLEMENT_PERMISSION.MANAGE)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: SettlementActionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.settlements.cancel(id, body, user);
  }
}
