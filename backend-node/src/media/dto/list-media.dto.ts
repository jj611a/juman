import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { parseOptionalBoolean } from '../../shared/validation/parse-boolean';
import { MEDIA_KIND } from '../../shared/constants/business.constants';
import { MEDIA_SORT_FIELDS } from '../media.constants';

export class ListMediaDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(Object.values(MEDIA_KIND))
  kind?: string;

  @IsOptional()
  @IsString()
  extension?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  deleted?: boolean | string;

  @IsOptional()
  @IsIn([...MEDIA_SORT_FIELDS])
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
