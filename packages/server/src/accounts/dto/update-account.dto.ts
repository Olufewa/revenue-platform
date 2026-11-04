import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateAccountDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  /** Archived accounts take no new entries; reversals are still allowed. */
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}
