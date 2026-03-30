import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateApiKeyDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

export class RotateApiKeyDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name?: string;
}
