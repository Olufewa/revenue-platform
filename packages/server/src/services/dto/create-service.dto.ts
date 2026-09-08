import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class CreateServiceDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  // The slug goes in URLs and in reports, so it is locked to lowercase
  // letters, digits and hyphens. Asking for it explicitly is simpler than
  // generating one and then having to explain what happened to the spaces.
  @IsString()
  @MinLength(2)
  @MaxLength(40)
  @Matches(/^[a-z0-9]+(-[a-z0-9]+)*$/, {
    message: 'Slug must be lowercase letters, digits and single hyphens',
  })
  slug!: string;
}
