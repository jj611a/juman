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
import { ItemsService } from './items.service';
import {
  AttachItemMediaDto,
  CreateItemDto,
  ListItemsDto,
  UpdateItemDto,
} from './dto/item.dto';

@Controller('items')
export class ItemsController {
  constructor(private readonly items: ItemsService) {}

  @Get()
  @RequirePermissions(INVENTORY_PERMISSION.VIEW)
  list(@Query() q: ListItemsDto) {
    return this.items.list(q);
  }

  @Get('search')
  @RequirePermissions(INVENTORY_PERMISSION.VIEW)
  search(@Query() q: ListItemsDto) {
    return this.items.search(q);
  }

  @Get('code/:internalCode')
  @RequirePermissions(INVENTORY_PERMISSION.VIEW)
  code(@Param('internalCode') c: string) {
    return this.items.getByInternalCode(c);
  }
  @Get(':id')
  @RequirePermissions(INVENTORY_PERMISSION.VIEW)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.items.getPublicById(id);
  }

  @Post()
  @RequirePermissions(INVENTORY_PERMISSION.CREATE)
  create(@Body() d: CreateItemDto, @CurrentUser() u: AuthPrincipal) {
    return this.items.create(d, u);
  }

  @Patch(':id')
  @RequirePermissions(INVENTORY_PERMISSION.UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: UpdateItemDto,
    @CurrentUser() u: AuthPrincipal,
  ) {
    return this.items.update(id, d, u);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions(INVENTORY_PERMISSION.DELETE)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: AuthPrincipal,
  ) {
    return this.items.softDelete(id, u);
  }
  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermissions(INVENTORY_PERMISSION.RESTORE)
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: AuthPrincipal,
  ) {
    return this.items.restore(id, u);
  }
  @Post(':id/media')
  @RequirePermissions(INVENTORY_PERMISSION.UPDATE)
  media(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: AttachItemMediaDto,
    @CurrentUser() u: AuthPrincipal,
  ) {
    return this.items.attachMedia(id, d, u);
  }
}
