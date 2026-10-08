import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { MAX_LOGO_BYTES } from '../utils/validate-tenant-logo';

const schema = z.strictObject({
  imageBase64: z.string().min(1).max(Math.ceil(MAX_LOGO_BYTES / 3) * 4 + 32),
});

export class UploadTenantLogoDto extends createZodDto(schema) {}
