import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Matches,
} from 'class-validator';

export class BrandDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  sortOrder?: number;

  @IsOptional()
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  nameEn?: string;

  @IsOptional()
  @Matches(/^#[0-9A-Fa-f]{6}$/)
  hexCode?: string;
}

export class ListBrandsDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  deleted?: string;

  @IsOptional()
  @IsInt()
  offset?: number;

  @IsOptional()
  @IsInt()
  limit?: number;
}
