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
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { RequirePermissions } from '../auth/decorators/require-permissions.decorator';
import type { AuthPrincipal } from '../shared/types';
import { BARCODE_PERMISSION } from './barcode.constants';
import { toPublicBarcode } from './barcode.mapper';
import { BarcodeService } from './barcode.service';
import {
  BarcodeValueDto,
  GenerateBarcodeDto,
  ReserveBarcodeDto,
  ValidateBarcodeDto,
} from './dto/barcode-actions.dto';
import { ListBarcodesDto } from './dto/list-barcodes.dto';

@Controller('barcodes')
export class BarcodeController {
  constructor(private readonly barcodes: BarcodeService) {}

  @Get()
  @RequirePermissions(BARCODE_PERMISSION.VIEW)
  list(@Query() query: ListBarcodesDto) {
    return this.barcodes.findMany(query);
  }

  @Get(':id')
  @RequirePermissions(BARCODE_PERMISSION.VIEW)
  getById(@Param('id', ParseUUIDPipe) id: string) {
    return this.barcodes.findPublic(id);
  }

  @Post('generate')
  @RequirePermissions(BARCODE_PERMISSION.GENERATE)
  async generate(@Body() body: GenerateBarcodeDto, @CurrentUser() user: AuthPrincipal) {
    const row = await this.barcodes.generate(
      {
        type: body.type as never,
        overrides: {
          prefix: body.prefix,
          separator: body.separator,
          padding: body.padding,
        },
      },
      user,
    );
    return toPublicBarcode(row);
  }

  @Post('validate')
  @HttpCode(200)
  @RequirePermissions(BARCODE_PERMISSION.VIEW)
  validate(@Body() body: ValidateBarcodeDto, @CurrentUser() user: AuthPrincipal) {
    return this.barcodes.validate(body.value, body.type, user);
  }

  @Post('reserve')
  @RequirePermissions(BARCODE_PERMISSION.RESERVE)
  async reserve(@Body() body: ReserveBarcodeDto, @CurrentUser() user: AuthPrincipal) {
    const row = await this.barcodes.reserve(
      {
        value: body.value,
        type: body.type as never,
        overrides: {
          prefix: body.prefix,
          separator: body.separator,
          padding: body.padding,
        },
      },
      user,
    );
    return toPublicBarcode(row);
  }

  @Post('release')
  @HttpCode(200)
  @RequirePermissions(BARCODE_PERMISSION.RELEASE)
  async release(@Body() body: BarcodeValueDto, @CurrentUser() user: AuthPrincipal) {
    return toPublicBarcode(await this.barcodes.release(body.value, user));
  }

  @Post('retire')
  @HttpCode(200)
  @RequirePermissions(BARCODE_PERMISSION.RETIRE)
  async retire(@Body() body: BarcodeValueDto, @CurrentUser() user: AuthPrincipal) {
    return toPublicBarcode(await this.barcodes.retire(body.value, user));
  }
}
