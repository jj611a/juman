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
import { INVENTORY_PERMISSION } from '../inventory.constants';
import { LifecycleService } from './lifecycle.service';
import {
  ListItemHistoryDto,
  TransitionItemDto,
} from './dto/transition-item.dto';

@Controller('items')
export class LifecycleController {
  constructor(private readonly lifecycle: LifecycleService) {}

  @Get(':id/state')
  @RequirePermissions(INVENTORY_PERMISSION.VIEW)
  state(@Param('id', ParseUUIDPipe) id: string) {
    return this.lifecycle.currentState(id);
  }

  @Get(':id/history')
  @RequirePermissions(INVENTORY_PERMISSION.VIEW)
  history(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ListItemHistoryDto,
  ) {
    return this.lifecycle.history(id, query);
  }

  @Post(':id/transition')
  @HttpCode(200)
  @RequirePermissions(INVENTORY_PERMISSION.TRANSITION)
  transition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: TransitionItemDto,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.lifecycle.transition(id, body, user);
  }
}
