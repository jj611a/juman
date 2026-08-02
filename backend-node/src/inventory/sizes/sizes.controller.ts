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
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../../auth/decorators/require-permissions.decorator';
import type { AuthPrincipal } from '../../shared/types';
import { INVENTORY_PERMISSION } from '../inventory.constants';
import { SizesService } from './sizes.service';
import { ListSizesDto, SizeDto } from './dto/size.dto';

@Controller('sizes')
export class SizesController {
  constructor(private readonly service: SizesService) {}

  @Get()
  @RequirePermissions(INVENTORY_PERMISSION.VIEW)
  list(@Query() q: ListSizesDto) {
    return this.service.list(q);
  }

  @Get(':id')
  @RequirePermissions(INVENTORY_PERMISSION.VIEW)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermissions(INVENTORY_PERMISSION.CREATE)
  create(@Body() d: SizeDto, @CurrentUser() u: AuthPrincipal) {
    return this.service.create(d, u);
  }

  @Patch(':id')
  @RequirePermissions(INVENTORY_PERMISSION.UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: SizeDto,
    @CurrentUser() u: AuthPrincipal,
  ) {
    return this.service.update(id, d, u);
  }
  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions(INVENTORY_PERMISSION.DELETE)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: AuthPrincipal,
  ) {
    return this.service.softDelete(id, u);
  }
  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermissions(INVENTORY_PERMISSION.RESTORE)
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: AuthPrincipal,
  ) {
    return this.service.restore(id, u);
  }
}
