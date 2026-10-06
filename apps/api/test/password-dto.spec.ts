import { RegisterAdminDto } from '../src/modules/auth/dto/register-admin.dto';
import { CreateUserDto, UpdateUserDto } from '../src/modules/users/dto/user.dto';

describe('password DTO policy', () => {
  const dtoCases = [
    ['admin registration', RegisterAdminDto.schema, { tenantName: 'Example Tenant', email: 'admin@example.test' }],
    ['user creation', CreateUserDto.schema, { email: 'user@example.test', role: 'editor' }],
    ['user update', UpdateUserDto.schema, {}],
  ] as const;

  it.each(dtoCases)('%s accepts a digit and a special character without requiring the letter d', (_name, schema, fields) => {
    expect(schema.safeParse({ ...fields, password: 'Secure1!' }).success).toBe(true);
  });

  it.each(dtoCases)('%s rejects passwords without a digit or a special character', (_name, schema, fields) => {
    expect(schema.safeParse({ ...fields, password: 'Secure!!' }).success).toBe(false);
    expect(schema.safeParse({ ...fields, password: 'Secure11' }).success).toBe(false);
    expect(schema.safeParse({ ...fields, password: 'short1!' }).success).toBe(false);
  });
});
