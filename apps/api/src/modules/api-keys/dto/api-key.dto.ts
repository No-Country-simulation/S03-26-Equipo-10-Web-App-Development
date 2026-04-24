import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateApiKeySchema = z.object({
  name: z.string().min(2).max(80),
});
export class CreateApiKeyDto extends createZodDto(CreateApiKeySchema) {}

const RotateApiKeySchema = z.object({
  name: z.string().min(2).max(80).optional(),
});
export class RotateApiKeyDto extends createZodDto(RotateApiKeySchema) {}
