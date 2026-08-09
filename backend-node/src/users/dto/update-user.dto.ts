import { IsString, Length, IsOptional, IsUUID } from 'class-validator';
import { USER_NAME_MAX } from '../users.constants';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Length(2, USER_NAME_MAX)
  fullName?: string;

  @IsOptional()
  @IsUUID()
  roleId?: string;
}