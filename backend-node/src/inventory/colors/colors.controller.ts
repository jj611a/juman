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
import { ColorsService } from './colors.service';
import { ColorDto, ListColorsDto } from './dto/color.dto';

@Controller('colors')
export class ColorsController {
  constructor(private readonly service: ColorsService) {}

  @Get()
  @RequirePermissions(INVENTORY_PERMISSION.VIEW)
  list(@Query() q: ListColorsDto) {
    return this.service.list(q);
  }

  @Get(':id')
  @RequirePermissions(INVENTORY_PERMISSION.VIEW)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermissions(INVENTORY_PERMISSION.CREATE)
  create(@Body() d: ColorDto, @CurrentUser() u: AuthPrincipal) {
    return this.service.create(d, u);
  }

  @Patch(':id')
  @RequirePermissions(INVENTORY_PERMISSION.UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: ColorDto,
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
