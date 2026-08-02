import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { BARCODE_STATUS } from '../../shared/constants/business.constants';
import { BARCODE_SORT_FIELDS, BARCODE_TYPES } from '../barcode.constants';

export class ListBarcodesDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  prefix?: string;

  @IsOptional()
  @IsIn(Object.values(BARCODE_STATUS))
  status?: string;

  @IsOptional()
  @IsIn([...BARCODE_TYPES])
  type?: string;

  @IsOptional()
  @IsString()
  entityType?: string;

  @IsOptional()
  @IsString()
  entityId?: string;

  @IsOptional()
  @IsIn([...BARCODE_SORT_FIELDS])
  sortBy?: string;

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
