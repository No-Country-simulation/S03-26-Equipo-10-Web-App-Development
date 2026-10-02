import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateWebhookSchema = z.object({
  url: z.string().url().refine(value => new URL(value).protocol === 'https:', 'Webhook URL must use HTTPS'),
  eventCode: z.string().max(120),
  isActive: z.boolean().optional(),
}).strict();
export class CreateWebhookDto extends createZodDto(CreateWebhookSchema) {}

const UpdateWebhookSchema = z.object({
  url: z.string().url().refine(value => new URL(value).protocol === 'https:', 'Webhook URL must use HTTPS').optional(),
  eventCode: z.string().max(120).optional(),
  isActive: z.boolean().optional(),
}).strict();
export class UpdateWebhookDto extends createZodDto(UpdateWebhookSchema) {}
