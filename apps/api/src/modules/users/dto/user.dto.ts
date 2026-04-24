import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*d)(?=.*[^A-Za-zd]).{8,72}$/, 'Password must contain uppercase, lowercase, number and special character'),
  role: z.enum(['admin', 'editor']),
});
export class CreateUserDto extends createZodDto(CreateUserSchema) {}

const UpdateUserSchema = z.object({
  password: z.string().regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*d)(?=.*[^A-Za-zd]).{8,72}$/, 'Password must contain uppercase, lowercase, number and special character').optional(),
  role: z.enum(['admin', 'editor']).optional(),
  isActive: z.boolean().optional(),
});
export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
