import { IsIn, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import type { AccountType } from '../../generated/prisma/client.js';

export const ACCOUNT_TYPES: AccountType[] = [
  'ASSET',
  'LIABILITY',
  'EQUITY',
  'INCOME',
  'EXPENSE',
];

export class CreateAccountDto {
  @IsString()
  @Matches(/^[a-z0-9]+(_[a-z0-9]+)*$/, {
    message: 'code must be lowercase letters, digits and single underscores',
  })
  @MaxLength(40)
  code!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsIn(ACCOUNT_TYPES)
  type!: AccountType;
}
