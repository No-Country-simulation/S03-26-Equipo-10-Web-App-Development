import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const RegisterAdminSchema = z.object({
  tenantName: z.string().min(3).max(120),
  email: z.string().email(),
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*d)(?=.*[^A-Za-zd]).{8,72}$/, 'Password must contain uppercase, lowercase, number and special character'),
});
export class RegisterAdminDto extends createZodDto(RegisterAdminSchema) {}
