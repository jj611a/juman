import { Global, Module } from '@nestjs/common';
import { BarcodeController } from './barcode.controller';
import { BarcodeRepository } from './barcode.repository';
import { BarcodeService } from './barcode.service';

@Global()
@Module({
  controllers: [BarcodeController],
  providers: [BarcodeRepository, BarcodeService],
  exports: [BarcodeService],
})
export class BarcodeModule {}
