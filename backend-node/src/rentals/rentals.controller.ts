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
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthPrincipal } from '../shared/types';
import {
  CreateRentalDto,
  ListRentalsDto,
  RentalActionDto,
} from './dto/rental.dto';
import { RENTAL_PERMISSION } from './rentals.constants';
import { RentalsService } from './rentals.service';

@Controller('rentals')
export class RentalsController {
  constructor(private readonly rentals: RentalsService) {}

  @Get()
  @RequirePermissions(RENTAL_PERMISSION.VIEW)
  list(@Query() query: ListRentalsDto) {
    return this.rentals.list(query);
  }

  @Get(':id')
  @RequirePermissions(RENTAL_PERMISSION.VIEW)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.rentals.getById(id);
  }

  @Post()
  @RequirePermissions(RENTAL_PERMISSION.CREATE)
  create(@Body() body: CreateRentalDto, @CurrentUser() user: AuthPrincipal) {
    return this.rentals.create(body, user);
  }

  @Post(':id/checkout')
  @HttpCode(200)
  @RequirePermissions(RENTAL_PERMISSION.CHECKOUT)
  checkout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RentalActionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.rentals.checkout(id, body.reason, user, body.depositAmountFils);
  }

  @Post(':id/return')
  @HttpCode(200)
  @RequirePermissions(RENTAL_PERMISSION.RETURN)
  initiateReturn(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RentalActionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.rentals.initiateReturn(id, body.reason, user);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions(RENTAL_PERMISSION.CANCEL)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RentalActionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.rentals.cancel(id, body.reason, user);
  }
}
