import { IsString, MaxLength, MinLength } from 'class-validator';
import { IsCurrencyCode } from '../../money/validators.js';

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsCurrencyCode()
  baseCurrency!: string;
}
