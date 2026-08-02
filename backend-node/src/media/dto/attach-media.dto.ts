import { IsBoolean, IsInt, IsOptional, IsString, MaxLength, Min, MinLength } from 'class-validator';

export class AttachMediaDto {
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  moduleName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  entityType!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  entityId!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  purpose!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}
