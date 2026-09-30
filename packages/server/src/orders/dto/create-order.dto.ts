import {
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { IsCurrencyCode } from '../../money/validators.js';

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  externalId!: string;

  @IsInt({ message: 'amount must be a whole number of minor units' })
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amount!: number;

  @IsCurrencyCode()
  currency!: string;

  @IsISO8601()
  placedAt!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  customerRef?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
