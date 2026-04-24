import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateTagSchema = z.object({
  name: z.string().min(2).max(80),
});
export class CreateTagDto extends createZodDto(CreateTagSchema) {}

const UpdateTagSchema = z.object({
  name: z.string().min(2).max(80),
});
export class UpdateTagDto extends createZodDto(UpdateTagSchema) {}
