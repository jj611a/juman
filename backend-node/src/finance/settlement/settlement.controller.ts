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
