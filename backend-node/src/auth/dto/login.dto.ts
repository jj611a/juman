import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  username!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  deviceName?: string;
}
