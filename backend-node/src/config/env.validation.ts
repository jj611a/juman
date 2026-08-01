import { plainToInstance, Type } from 'class-transformer';
import {
  IsBooleanString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsOptional()
  @IsString()
  DATABASE_URL?: string;

  @IsOptional()
  @IsString()
  JUMAN_DATA_DIR?: string;

  @IsOptional()
  @IsString()
  APP_VERSION?: string;

  @IsOptional()
  @IsString()
  APP_NAME?: string;

  @IsOptional()
  @IsIn(['development', 'production', 'test'])
  APP_ENV?: 'development' | 'production' | 'test';

  @IsOptional()
  @IsString()
  LOG_LEVEL?: string;

  @IsOptional()
  @IsString()
  HOST?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(65535)
  PORT?: number;

  @IsOptional()
  @IsString()
  @MinLength(32)
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_ISSUER?: string;

  @IsOptional()
  @IsString()
  JWT_AUDIENCE?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ACCESS_TOKEN_EXPIRE_MINUTES?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  REFRESH_TOKEN_EXPIRE_DAYS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  REMEMBER_ME_REFRESH_TOKEN_EXPIRE_DAYS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ARGON2_TIME_COST?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ARGON2_MEMORY_COST?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  ARGON2_PARALLELISM?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  MAX_FAILED_LOGIN_ATTEMPTS?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  ACCOUNT_LOCK_DURATION_MINUTES?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(8)
  PASSWORD_MIN_LENGTH?: number;

  @IsOptional()
  @IsBooleanString()
  PASSWORD_REQUIRE_COMPLEXITY?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  PASSWORD_HISTORY_COUNT?: number;
}

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });
  const errors = validateSync(env, { whitelist: true, forbidUnknownValues: false });
  if (errors.length > 0) {
    const details = errors
      .map((e) => Object.values(e.constraints ?? {}).join(', '))
      .join('; ');
    throw new Error(`Invalid environment configuration: ${details}`);
  }
  return { ...config, ...env };
}
