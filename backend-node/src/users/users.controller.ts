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
import { USER_PERMISSION } from './users.constants';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { ListUsersDto } from './dto/list-users.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(USER_PERMISSION.VIEW)
  list(@Query() query: ListUsersDto) {
    return this.users.list(query);
  }

  @Get(':id')
  @RequirePermissions(USER_PERMISSION.VIEW)
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.users.getById(id);
  }

  @Post()
  @RequirePermissions(USER_PERMISSION.CREATE)
  create(@Body() body: CreateUserDto, @CurrentUser() user: AuthPrincipal) {
    return this.users.createUser({ ...body, createdBy: user.userId });
  }

  @Patch(':id')
  @RequirePermissions(USER_PERMISSION.UPDATE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.users.updateProfile(id, body, user);
  }

  @Post(':id/deactivate')
  @HttpCode(200)
  @RequirePermissions(USER_PERMISSION.UPDATE)
  deactivate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.users.setActiveState(id, false, user);
  }

  @Post(':id/activate')
  @HttpCode(200)
  @RequirePermissions(USER_PERMISSION.UPDATE)
  activate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.users.setActiveState(id, true, user);
  }

  @Post(':id/unlock')
  @HttpCode(200)
  @RequirePermissions(USER_PERMISSION.UNLOCK)
  unlock(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.users.unlock(id, user);
  }

  @Post(':id/reset-password')
  @HttpCode(200)
  @RequirePermissions(USER_PERMISSION.UPDATE)
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: ResetPasswordDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.users.resetPassword(id, body.newPassword, user);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions(USER_PERMISSION.DELETE)
  softDelete(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.users.softDelete(id, user);
  }

  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermissions(USER_PERMISSION.UPDATE)
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthPrincipal) {
    return this.users.restore(id, user);
  }
}