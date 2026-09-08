import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateApiKeyDto {
  // A label so a human can tell two keys apart later - "staging", "billing
  // cron". It has nothing to do with authentication.
  @IsString()
  @MinLength(2)
  @MaxLength(60)
  name!: string;
}
