import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  CUSTOMER_ADDRESS_MAX,
  CUSTOMER_CITY_MAX,
  CUSTOMER_GENDER,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NATIONAL_ID_MAX,
  CUSTOMER_NOTES_MAX,
  CUSTOMER_PHONE_MAX,
  CUSTOMER_STATUS,
} from '../customers.constants';

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(CUSTOMER_NAME_MAX)
  fullName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(CUSTOMER_PHONE_MAX)
  phone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CUSTOMER_PHONE_MAX)
  secondaryPhone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CUSTOMER_ADDRESS_MAX)
  address?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(CUSTOMER_CITY_MAX)
  city?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(CUSTOMER_NATIONAL_ID_MAX)
  nationalId?: string | null;

  @IsOptional()
  @IsIn(Object.values(CUSTOMER_GENDER))
  gender?: string | null;

  @IsOptional()
  @IsDateString()
  birthDate?: string | null;

  @IsOptional()
  @IsBoolean()
  clearBirthDate?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(CUSTOMER_NOTES_MAX)
  notes?: string | null;

  @IsOptional()
  @IsIn(Object.values(CUSTOMER_STATUS))
  status?: string;
}