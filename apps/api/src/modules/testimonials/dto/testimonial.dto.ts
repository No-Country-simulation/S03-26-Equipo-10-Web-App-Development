import { IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, IsIn } from 'class-validator';

export class CreateTestimonialDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  authorName!: string;

  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  content!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class UpdateTestimonialDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  authorName?: string;

  @IsOptional()
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  content?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  rating?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;
}

export class ModerateTestimonialDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class PublicTestimonialsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  tag?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(['score:desc', 'publishedAt:desc'])
  sort?: 'score:desc' | 'publishedAt:desc';

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
