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
import { CATEGORY_PERMISSION } from '../inventory.constants';
import { CategoriesService } from './categories.service';
import { CategoryDto, ListCategoriesDto } from './dto/category.dto';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly service: CategoriesService) {}

  @Get()
  @RequirePermissions(CATEGORY_PERMISSION.VIEW)
  list(@Query() q: ListCategoriesDto) {
    return this.service.list(q);
  }

  @Get(':id')
  @RequirePermissions(CATEGORY_PERMISSION.VIEW)
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Post()
  @RequirePermissions(CATEGORY_PERMISSION.CREATE)
  create(@Body() d: CategoryDto, @CurrentUser() u: AuthPrincipal) {
    return this.service.create(d, u);
  }

  @Patch(':id')
  @RequirePermissions(CATEGORY_PERMISSION.UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() d: CategoryDto,
    @CurrentUser() u: AuthPrincipal,
  ) {
    return this.service.update(id, d, u);
  }
  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions(CATEGORY_PERMISSION.DELETE)
  delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: AuthPrincipal,
  ) {
    return this.service.softDelete(id, u);
  }
  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermissions(CATEGORY_PERMISSION.RESTORE)
  restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: AuthPrincipal,
  ) {
    return this.service.restore(id, u);
  }
}
