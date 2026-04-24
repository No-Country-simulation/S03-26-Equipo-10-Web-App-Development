import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateWebhookSchema = z.object({
  url: z.string().url(),
  eventCode: z.string().max(120),
  secret: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
});
export class CreateWebhookDto extends createZodDto(CreateWebhookSchema) {}

const UpdateWebhookSchema = z.object({
  url: z.string().url().optional(),
  eventCode: z.string().max(120).optional(),
  secret: z.string().max(255).optional(),
  isActive: z.boolean().optional(),
});
export class UpdateWebhookDto extends createZodDto(UpdateWebhookSchema) {}
