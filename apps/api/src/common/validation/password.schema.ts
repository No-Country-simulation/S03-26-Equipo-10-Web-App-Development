import { z } from 'zod';

export const PasswordSchema = z.string().regex(
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,72}$/,
  'Password must contain uppercase, lowercase, number and special character',
);
