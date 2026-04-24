import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateTestimonialSchema = z.object({
  authorName: z.string().min(2).max(120),
  content: z.string().min(10).max(1000),
  rating: z.number().int().min(1).max(5),
  categoryId: z.string().uuid().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});
export class CreateTestimonialDto extends createZodDto(CreateTestimonialSchema) {}

const UpdateTestimonialSchema = z.object({
  authorName: z.string().min(2).max(120).optional(),
  content: z.string().min(10).max(1000).optional(),
  rating: z.number().int().min(1).max(5).optional(),
  categoryId: z.string().uuid().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});
export class UpdateTestimonialDto extends createZodDto(UpdateTestimonialSchema) {}

const ModerateTestimonialSchema = z.object({
  reason: z.string().max(500).optional(),
});
export class ModerateTestimonialDto extends createZodDto(ModerateTestimonialSchema) {}

const PublicTestimonialsQuerySchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  category: z.string().optional(),
  sort: z.enum(['score:desc', 'publishedAt:desc']).optional(),
  page: z.coerce.number().optional(),
  limit: z.coerce.number().optional(),
});
export class PublicTestimonialsQueryDto extends createZodDto(PublicTestimonialsQuerySchema) {}

const UploadImageSchema = z.object({
  imageBase64: z.string(),
});
export class UploadImageDto extends createZodDto(UploadImageSchema) {}

const AttachVideoSchema = z.object({
  videoUrl: z.string().url(),
});
export class AttachVideoDto extends createZodDto(AttachVideoSchema) {}

const SubmitPublicTestimonialSchema = z.object({
  authorName: z.string().min(2).max(120),
  content: z.string().min(10).max(1000),
  rating: z.number().int().min(1).max(5),
  imageBase64: z.string().optional(),
  videoUrl: z.string().url().optional(),
});
export class SubmitPublicTestimonialDto extends createZodDto(SubmitPublicTestimonialSchema) {}
