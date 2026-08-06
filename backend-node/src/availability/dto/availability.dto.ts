import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class QueryAvailabilityDto {
  @IsUUID()
  itemId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;
}

export class QueryCalendarDto {
  @IsDateString()
  start!: string;

  @IsDateString()
  end!: string;

  @IsOptional()
  @IsUUID()
  itemId?: string;
}
