import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { parseOptionalBoolean } from '../../shared/validation/parse-boolean';
import { USER_STATUS, USER_SORT_FIELDS } from '../users.constants';

export class ListUsersDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(Object.values(USER_STATUS))
  status?: string;

  @IsOptional()
  @IsString()
  roleId?: string;

  /** When true, list soft-deleted rows only. When false/omitted, live rows. */
  @IsOptional()
  @Transform(({ value }) => parseOptionalBoolean(value))
  @IsBoolean()
  deleted?: boolean | string;

  @IsOptional()
  @IsIn([...USER_SORT_FIELDS])
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