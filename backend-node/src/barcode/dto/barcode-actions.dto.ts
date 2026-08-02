import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { BARCODE_TYPES } from '../barcode.constants';

export class GenerateBarcodeDto {
  @IsOptional()
  @IsIn([...BARCODE_TYPES])
  type?: string;

  @IsOptional()
  @IsString()
  @MaxLength(16)
  prefix?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1)
  separator?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(16)
  padding?: number;
}

export class ReserveBarcodeDto extends GenerateBarcodeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  value?: string;
}

export class ValidateBarcodeDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  value!: string;

  @IsOptional()
  @IsIn([...BARCODE_TYPES])
  type?: string;
}

export class BarcodeValueDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2048)
  value!: string;
}
