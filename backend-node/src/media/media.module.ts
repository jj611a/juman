import { Global, Module } from '@nestjs/common';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';

@Global()
@Module({
  providers: [MediaRepository, MediaService],
  exports: [MediaService],
})
export class MediaModule {}