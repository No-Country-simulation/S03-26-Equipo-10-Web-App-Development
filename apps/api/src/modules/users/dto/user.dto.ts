import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { PasswordSchema } from '../../../common/validation/password.schema';

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: PasswordSchema,
  role: z.enum(['admin', 'editor']),
});
export class CreateUserDto extends createZodDto(CreateUserSchema) {}

const UpdateUserSchema = z.object({
  password: PasswordSchema.optional(),
  role: z.enum(['admin', 'editor']).optional(),
  isActive: z.boolean().optional(),
});
export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
