import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTagDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}

export class UpdateTagDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;
}
