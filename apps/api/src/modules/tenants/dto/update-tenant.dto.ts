import { IsBoolean, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'publicSlug can only contain lowercase letters, numbers, and hyphens',
  })
  publicSlug?: string;

  @IsOptional()
  @IsBoolean()
  isPublicFormEnabled?: boolean;
}
