import {
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

export class CreateCustomerDto {
  @IsString()
  @MinLength(1)
  @MaxLength(CUSTOMER_NAME_MAX)
  fullName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(CUSTOMER_PHONE_MAX)
  phone!: string;

  @IsOptional()
  @IsString()
  @MaxLength(CUSTOMER_PHONE_MAX)
  secondaryPhone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CUSTOMER_ADDRESS_MAX)
  address?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CUSTOMER_CITY_MAX)
  city?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(CUSTOMER_NATIONAL_ID_MAX)
  nationalId?: string;

  @IsOptional()
  @IsIn(Object.values(CUSTOMER_GENDER))
  gender?: string;

  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(CUSTOMER_NOTES_MAX)
  notes?: string;

  @IsOptional()
  @IsIn(Object.values(CUSTOMER_STATUS))
  status?: string;
}