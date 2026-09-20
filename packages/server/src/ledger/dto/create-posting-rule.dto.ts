import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsInt,
  IsISO8601,
  IsNotEmpty,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class PostingRuleLineDto {
  @IsString()
  @IsNotEmpty()
  accountCode!: string;

  @IsIn(['DEBIT', 'CREDIT'])
  direction!: 'DEBIT' | 'CREDIT';

  @IsInt()
  @Min(1)
  numerator!: number;

  @IsInt()
  @Min(1)
  denominator!: number;
}

export class CreatePostingRuleDto {
  @IsString()
  @IsNotEmpty()
  eventType!: string;

  @IsISO8601()
  effectiveFrom!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => PostingRuleLineDto)
  lines!: PostingRuleLineDto[];
}
