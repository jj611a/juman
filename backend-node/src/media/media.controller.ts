import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import { BusinessException } from '../shared/errors/business.exception';
import type { AuthPrincipal } from '../shared/types';
import { MEDIA_PERMISSION } from './media.constants';
import { toPublicMedia } from './media.mapper';
import { MediaService } from './media.service';
import { ListMediaDto } from './dto/list-media.dto';

@Controller('media')
export class MediaController {
  constructor(private readonly media: MediaService) {}

  @Get()
  @RequirePermissions(MEDIA_PERMISSION.VIEW)
  list(@Query() query: ListMediaDto) {
    return this.media.findMany(query);
  }

  @Get(':id')
  @RequirePermissions(MEDIA_PERMISSION.VIEW)
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.media.findPublic(id);
  }

  @Get(':id/integrity')
  @RequirePermissions(MEDIA_PERMISSION.VIEW)
  verifyIntegrity(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.media.verifyIntegrity(id, user);
  }

  @Post()
  @RequirePermissions(MEDIA_PERMISSION.UPLOAD)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { files: 1 },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() user: AuthPrincipal,
  ) {
    if (!file) {
      throw BusinessException.validation('file is required');
    }
    const saved = await this.media.save(
      {
        buffer: file.buffer,
        originalFilename: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
      },
      user,
    );
    return toPublicMedia(saved);
  }

  @Delete(':id')
  @HttpCode(200)
  @RequirePermissions(MEDIA_PERMISSION.DELETE)
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return toPublicMedia(await this.media.delete(id, user));
  }

  @Post(':id/restore')
  @HttpCode(200)
  @RequirePermissions(MEDIA_PERMISSION.RESTORE)
  async restore(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return toPublicMedia(await this.media.restore(id, user));
  }
}
