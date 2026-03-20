import { IsInt, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';

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
}
