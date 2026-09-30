import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import type { EntryDirection } from '../../generated/prisma/client.js';
import { IsCurrencyCode, IsExchangeRate } from '../../common/validators.js';

export class EntryLegDto {
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  accountCode!: string;

  @IsIn(['DEBIT', 'CREDIT'])
  direction!: EntryDirection;

  @IsInt({ message: 'amount must be a whole number of minor units' })
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amount!: number;
}

export class CreateTransactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  externalId!: string;

  @IsISO8601()
  occurredAt!: string;

  /** Defaults to the order's currency. */
  @IsOptional()
  @IsCurrencyCode()
  currency?: string;

  /** Base-currency units per unit of `currency`, e.g. "1550.25". */
  @IsOptional()
  @IsExchangeRate()
  exchangeRate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => EntryLegDto)
  entries!: EntryLegDto[];
}

/** `POST /transactions`: the order is optional, e.g. for fees or settlements. */
export class CreateStandaloneTransactionDto extends CreateTransactionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  orderId?: string;
}
