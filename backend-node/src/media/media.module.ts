import { Global, Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaRepository } from './media.repository';
import { MediaService } from './media.service';
import { LocalStorageProvider } from './providers/local-storage.provider';

@Global()
@Module({
  controllers: [MediaController],
  providers: [MediaRepository, LocalStorageProvider, MediaService],
  exports: [MediaService],
})
export class MediaModule {}
