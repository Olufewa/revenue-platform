import { IsISO8601, IsOptional } from 'class-validator';

export class BalancesQueryDto {
  /** Include entries up to and including this instant. Defaults to now. */
  @IsOptional()
  @IsISO8601()
  asOf?: string;
}
