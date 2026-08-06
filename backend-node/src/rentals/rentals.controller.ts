import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
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
  CreateRentalDto,
  ListRentalsDto,
  RentalActionDto,
  UpdateRentalDto,
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

  @Get(':id/audit')
  @RequireAnyPermission('audit.view', RENTAL_PERMISSION.VIEW)
  audit(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('offset') offset?: string,
    @Query('limit') limit?: string,
  ) {
    return this.rentals.listAudit(id, {
      offset: offset != null ? Number(offset) : undefined,
      limit: limit != null ? Number(limit) : undefined,
    });
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

  @Post(':id/notes')
  @HttpCode(200)
  @RequireAnyPermission(RENTAL_PERMISSION.CREATE, RENTAL_PERMISSION.CHECKOUT)
  updateNotes(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRentalDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.rentals.update(id, body, user);
  }

  @Patch(':id')
  @RequireAnyPermission(RENTAL_PERMISSION.CREATE, RENTAL_PERMISSION.CHECKOUT)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateRentalDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.rentals.update(id, body, user);
  }

  @Post(':id/checkout')
  @HttpCode(200)
  @RequirePermissions(RENTAL_PERMISSION.CHECKOUT)
  checkout(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RentalActionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.rentals.checkout(
      id,
      body.reason,
      user,
      body.depositAmountFils,
      body.idempotencyKey,
    );
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

  @Post(':id/complete')
  @HttpCode(200)
  @RequirePermissions(RENTAL_PERMISSION.RETURN)
  complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RentalActionDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.rentals.complete(id, body.reason, user);
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
