import { Global, Module } from '@nestjs/common';
import { BarcodeRepository } from './barcode.repository';
import { BarcodeService } from './barcode.service';

@Global()
@Module({
  providers: [BarcodeRepository, BarcodeService],
  exports: [BarcodeService],
})
export class BarcodeModule {}