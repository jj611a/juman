import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateRentalItemDto {
  @IsUUID()
  itemId!: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  barcode?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  agreedRentalPrice?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateRentalDto {
  @IsUUID()
  customerId!: string;

  @IsDateString()
  rentalDate!: string;

  @IsDateString()
  expectedReturnDate!: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateRentalItemDto)
  items!: CreateRentalItemDto[];
}

export class ListRentalsDto {
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
  rentalNumber?: string;

  @IsOptional()
  @IsString()
  deleted?: string;

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

export class RentalActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  /** Optional deposit in fils registered via FinancialService on checkout. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  depositAmountFils?: number;

  /** Client idempotency key — duplicate checkout requests replay prior result. */
  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
