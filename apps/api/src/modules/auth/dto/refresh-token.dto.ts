import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(20),
});
export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}
