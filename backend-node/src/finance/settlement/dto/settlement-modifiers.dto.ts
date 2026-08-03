import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  DISCOUNT_BASIS,
  DISCOUNT_KIND,
  LATE_FEE_KIND,
} from '../settlement.constants';

export class SettlementRefundDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountFils!: number;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class SettlementAdjustmentDto {
  /** Signed fils — positive increases obligation; negative decreases. */
  @Type(() => Number)
  @IsInt()
  amountFils!: number;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class SettlementDiscountDto {
  @IsIn([DISCOUNT_KIND.PERCENTAGE, DISCOUNT_KIND.FIXED])
  kind!: string;

  @IsOptional()
  @IsIn([DISCOUNT_BASIS.RENTAL, DISCOUNT_BASIS.SETTLEMENT])
  basis?: string;

  @ValidateIf((o: SettlementDiscountDto) => o.kind === DISCOUNT_KIND.PERCENTAGE)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  percentBps?: number;

  @ValidateIf((o: SettlementDiscountDto) => o.kind === DISCOUNT_KIND.FIXED)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  amountFils?: number;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}

export class SettlementLateFeeDto {
  @IsIn([LATE_FEE_KIND.FLAT, LATE_FEE_KIND.DAILY])
  kind!: string;

  @ValidateIf((o: SettlementLateFeeDto) => o.kind === LATE_FEE_KIND.FLAT)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  flatFils?: number;

  @ValidateIf((o: SettlementLateFeeDto) => o.kind === LATE_FEE_KIND.DAILY)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  dailyFils?: number;

  @ValidateIf((o: SettlementLateFeeDto) => o.kind === LATE_FEE_KIND.DAILY)
  @Type(() => Number)
  @IsInt()
  @Min(1)
  daysCharged?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  maxFils?: number;

  @IsString()
  @MaxLength(500)
  reason!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  idempotencyKey?: string;
}
