import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSaleItemDto {
  @IsUUID()
  itemId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  priceFils?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountFils?: number;

  /** Future-proof; must be 1 in Phase 6.7. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string;
}

export class CreateSaleDto {
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountFils?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  taxFils?: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];
}

export class ListSalesDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsString()
  saleNumber?: string;

  @IsOptional()
  @IsString()
  sortBy?: string;

  @IsOptional()
  @IsString()
  sortDir?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number;
}

export class SaleActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;

  /** Assign / replace customer before completion (Walk-in → real customer). */
  @IsOptional()
  @IsUUID()
  customerId?: string;
}

export class SalePaymentDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountFils!: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  method?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class SaleCompleteDto extends SaleActionDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  paymentAmountFils?: number;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  paymentMethod?: string;
}
