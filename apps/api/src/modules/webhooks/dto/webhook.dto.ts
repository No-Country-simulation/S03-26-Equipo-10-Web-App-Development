import { IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateWebhookDto {
  @IsUrl()
  url!: string;

  @IsString()
  @MaxLength(120)
  eventCode!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  secret?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWebhookDto {
  @IsOptional()
  @IsUrl()
  url?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  eventCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  secret?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
