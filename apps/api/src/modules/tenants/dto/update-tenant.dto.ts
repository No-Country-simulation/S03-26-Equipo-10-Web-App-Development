import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateTenantSchema = z.object({
  name: z.string().min(3).max(120).optional(),
  publicSlug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/, 'publicSlug can only contain lowercase letters, numbers, and hyphens').optional(),
  isPublicFormEnabled: z.boolean().optional(),
});
export class UpdateTenantDto extends createZodDto(UpdateTenantSchema) {}
