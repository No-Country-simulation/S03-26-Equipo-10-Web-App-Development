import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const UpdateFeatureFlagSchema = z.object({
  enabled: z.boolean(),
});
export class UpdateFeatureFlagDto extends createZodDto(UpdateFeatureFlagSchema) {}
