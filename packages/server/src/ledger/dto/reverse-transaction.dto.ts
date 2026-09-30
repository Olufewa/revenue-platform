import {
  IsISO8601,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ReverseTransactionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  externalId!: string;

  /** Defaults to now. */
  @IsOptional()
  @IsISO8601()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
