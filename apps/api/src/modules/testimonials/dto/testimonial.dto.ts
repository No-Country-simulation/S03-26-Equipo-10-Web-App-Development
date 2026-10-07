import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

// PostgreSQL char_length counts Unicode code points; JavaScript's .length
// counts UTF-16 units. Keep API validation aligned with the database CHECK.
const TestimonialContentSchema = z.string().min(10).max(1000).refine(
  content => [...content].length >= 10,
  { message: 'Content must contain at least 10 characters' },
);

const CreateTestimonialSchema = z.object({
  authorName: z.string().min(2).max(120),
  content: TestimonialContentSchema,
  rating: z.number().int().min(1).max(5),
  categoryId: z.string().uuid().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});
export class CreateTestimonialDto extends createZodDto(CreateTestimonialSchema) {}

const UpdateTestimonialSchema = z.object({
  authorName: z.string().min(2).max(120).optional(),
  content: TestimonialContentSchema.optional(),
  rating: z.number().int().min(1).max(5).optional(),
  categoryId: z.string().uuid().optional(),
  tagIds: z.array(z.string().uuid()).optional(),
});
export class UpdateTestimonialDto extends createZodDto(UpdateTestimonialSchema) {}

const ModerateTestimonialSchema = z.object({
  reason: z.string().max(500).optional(),
});
export class ModerateTestimonialDto extends createZodDto(ModerateTestimonialSchema) {}

const positiveQueryInteger = (maximum: number) => z.string().regex(/^[1-9]\d*$/)
  .transform(Number).pipe(z.number().int().max(maximum));

const PublicTestimonialsQuerySchema = z.object({
  q: z.string().max(200).optional(),
  tag: z.string().max(80).optional(),
  category: z.string().max(80).optional(),
  sort: z.enum(['score:desc', 'publishedAt:desc']).optional(),
  page: positiveQueryInteger(10_000).optional(),
  limit: positiveQueryInteger(100).optional(),
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
  content: TestimonialContentSchema,
  rating: z.number().int().min(1).max(5),
  imageBase64: z.string().optional(),
  videoUrl: z.string().url().optional(),
});
export class SubmitPublicTestimonialDto extends createZodDto(SubmitPublicTestimonialSchema) {}
