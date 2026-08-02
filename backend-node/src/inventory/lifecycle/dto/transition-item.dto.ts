import { IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ITEM_LIFECYCLE_VALUES } from '../../inventory.constants';

export class TransitionItemDto {
  @IsString()
  @IsIn([...ITEM_LIFECYCLE_VALUES])
  newState!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referenceType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  referenceId?: string;

  /** Optimistic concurrency token — must match current lifecycle when set. */
  @IsOptional()
  @IsString()
  @IsIn([...ITEM_LIFECYCLE_VALUES])
  expectedState?: string;
}

export class ListItemHistoryDto {
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
