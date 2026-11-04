import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsCurrencyCode, IsTimeZone } from '../../common/validators.js';

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsCurrencyCode()
  baseCurrency!: string;

  /** Which local day revenue is reported under. Defaults to Africa/Lagos. */
  @IsOptional()
  @IsTimeZone()
  timezone?: string;
}
