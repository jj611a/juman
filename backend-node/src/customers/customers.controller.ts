import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthPrincipal } from '../shared/types';
import { CUSTOMER_PERMISSION } from './customers.constants';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermissions(CUSTOMER_PERMISSION.VIEW)
  list(@Query() query: ListCustomersDto) {
    return this.customers.list(query);
  }

  @Get('search')
  @RequirePermissions(CUSTOMER_PERMISSION.VIEW)
  search(@Query() query: ListCustomersDto) {
    return this.customers.search(query);
  }

  @Get('number/:customerNumber')
  @RequirePermissions(CUSTOMER_PERMISSION.VIEW)
  getByNumber(@Param('customerNumber') customerNumber: string) {
    return this.customers.getByNumber(customerNumber);
  }

  @Get(':id')
  @RequirePermissions(CUSTOMER_PERMISSION.VIEW)
  getById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.customers.getById(id, user);
  }

  @Post()
  @RequirePermissions(CUSTOMER_PERMISSION.CREATE)
  create(@Body() body: CreateCustomerDto, @CurrentUser() user: AuthPrincipal) {
    return this.customers.create(body, user);
  }

  @Patch(':id')
  @RequirePermissions(CUSTOMER_PERMISSION.UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateCustomerDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.customers.update(id, body, user);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions(CUSTOMER_PERMISSION.DELETE)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.customers.softDelete(id, user);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermissions(CUSTOMER_PERMISSION.RESTORE)
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.customers.restore(id, user);
  }
}