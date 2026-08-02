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
  CreateReservationDto,
  ListReservationsDto,
  ReservationActionDto,
} from './dto/reservation.dto';
import { RESERVATION_PERMISSION } from './reservations.constants';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  @Get()
  @RequirePermissions(RESERVATION_PERMISSION.VIEW)
  list(@Query() query: ListReservationsDto) {
    return this.reservations.list(query);
  }

  @Get(':id')
  @RequirePermissions(RESERVATION_PERMISSION.VIEW)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservations.getById(id);
  }

  @Post()
  @RequirePermissions(RESERVATION_PERMISSION.CREATE)
  create(
    @Body() body: CreateReservationDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reservations.create(body, user);
  }

  @Post(':id/checkout')
  @HttpCode(200)
  @RequirePermissions(RESERVATION_PERMISSION.CHECKOUT)
  checkout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReservationActionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reservations.checkout(
      id,
      body.reason,
      user,
      body.depositAmountFils,
    );
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermissions(RESERVATION_PERMISSION.CANCEL)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReservationActionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reservations.cancel(id, body.reason, user);
  }

  @Post(':id/expire')
  @HttpCode(200)
  @RequirePermissions(RESERVATION_PERMISSION.EXPIRE)
  expire(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ReservationActionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.reservations.expireReservation(id, body.reason, user);
  }
}
