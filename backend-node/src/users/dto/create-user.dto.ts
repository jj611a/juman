import { IsString, Length, IsOptional, IsBoolean, IsUUID } from 'class-validator';
import { USER_USERNAME_MAX, USER_USERNAME_MIN, USER_NAME_MAX } from '../users.constants';

export class CreateUserDto {
  @IsString()
  @Length(USER_USERNAME_MIN, USER_USERNAME_MAX)
  username!: string;

  @IsString()
  @Length(USER_USERNAME_MIN, USER_NAME_MAX)
  fullName!: string;

  @IsString()
  @Length(8, 128)
  password!: string;

  @IsUUID()
  roleId!: string;

  @IsOptional()
  @IsBoolean()
  mustChangePassword?: boolean;
}