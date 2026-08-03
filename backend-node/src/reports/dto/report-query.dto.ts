import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import {
  REPORT_EXPORT_FORMAT,
  REPORT_KIND_VALUES,
} from '../reports.constants';

/** Shared report filter / pagination query. */
export class ReportQueryDto {
  @IsOptional()
  @IsISO8601()
  from?: string;

  @IsOptional()
  @IsISO8601()
  to?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  status?: string;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsUUID()
  brandId?: string;

  @IsOptional()
  @IsUUID()
  colorId?: string;

  @IsOptional()
  @IsUUID()
  sizeId?: string;

  @IsOptional()
  @IsUUID()
  customerId?: string;

  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;

  @IsOptional()
  @IsUUID()
  settlementId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sortBy?: string;

  @IsOptional()
  @IsString()
  @MaxLength(8)
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

export class ReportExportQueryDto extends ReportQueryDto {
  @IsIn([
    REPORT_EXPORT_FORMAT.CSV,
    REPORT_EXPORT_FORMAT.JSON,
    REPORT_EXPORT_FORMAT.PDF,
    REPORT_EXPORT_FORMAT.EXCEL,
  ])
  format!: string;

  @IsIn([...REPORT_KIND_VALUES])
  report!: string;
}
