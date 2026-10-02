import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const scopesSchema = z.array(z.enum(['testimonials:read', 'analytics:write']))
  .min(1).max(2).refine(scopes => new Set(scopes).size === scopes.length, 'Duplicate scope');
const expirySchema = z.iso.datetime({ offset: false, local: false })
  .refine(value => Date.parse(value) > Date.now(), 'Expiration must be in the future');

const CreateApiKeySchema = z.object({
  name: z.string().min(2).max(80),
  scopes: scopesSchema,
  expiresAt: expirySchema.optional(),
});
export class CreateApiKeyDto extends createZodDto(CreateApiKeySchema) {}

const RotateApiKeySchema = z.object({
  name: z.string().min(2).max(80).optional(),
  scopes: scopesSchema.optional(),
  expiresAt: expirySchema.optional(),
});
export class RotateApiKeyDto extends createZodDto(RotateApiKeySchema) {}
