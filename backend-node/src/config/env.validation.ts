import { plainToInstance } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, validateSync } from 'class-validator';
class Env { @IsOptional() @IsString() DATABASE_URL?: string; @IsOptional() @IsString() JUMAN_DATA_DIR?: string; @IsOptional() @IsString() APP_VERSION?: string; @IsOptional() @IsInt() @Min(1) @Max(65535) PORT?: number; }
export function validateEnvironment(config: Record<string, unknown>): Record<string, unknown> { const env = plainToInstance(Env, config, { enableImplicitConversion: true }); const errors = validateSync(env); if (errors.length) throw new Error(`Invalid environment configuration: ${errors}`); return env as unknown as Record<string, unknown>; }
