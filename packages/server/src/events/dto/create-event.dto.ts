import {
  IsInt,
  IsISO8601,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateEventDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  externalId!: string;

  @IsString()
  @Matches(/^[a-z0-9]+(\.[a-z0-9]+)+$/, {
    message: 'Type must look like "airtime.purchase"',
  })
  type!: string;

  @IsInt({ message: 'amountMinor must be a whole number of minor units' })
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  amountMinor!: number;

  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'Currency must be a 3-letter code' })
  currency!: string;

  @IsISO8601()
  occurredAt!: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  reversesExternalId?: string;
}
