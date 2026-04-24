import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateCategorySchema = z.object({
  name: z.string().min(2).max(80),
});
export class CreateCategoryDto extends createZodDto(CreateCategorySchema) {}

const UpdateCategorySchema = z.object({
  name: z.string().min(2).max(80),
});
export class UpdateCategoryDto extends createZodDto(UpdateCategorySchema) {}
