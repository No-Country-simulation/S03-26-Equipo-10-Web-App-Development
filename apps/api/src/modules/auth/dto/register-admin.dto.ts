import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PasswordSchema } from '../../../common/validation/password.schema';

const RegisterAdminSchema = z.object({
  tenantName: z.string().min(3).max(120),
  email: z.string().email(),
  password: PasswordSchema,
});
export class RegisterAdminDto extends createZodDto(RegisterAdminSchema) {}
