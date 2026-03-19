import { IsEnum } from 'class-validator';

export class UpdateTestimonialStatusDto {
  @IsEnum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status!: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}
