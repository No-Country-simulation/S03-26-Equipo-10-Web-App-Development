import { IsEmail, IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  password!: string;

  @IsIn(['admin', 'editor'])
  role!: 'admin' | 'editor';
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  password?: string;

  @IsOptional()
  @IsIn(['admin', 'editor'])
  role?: 'admin' | 'editor';

  @IsOptional()
  isActive?: boolean;
}
