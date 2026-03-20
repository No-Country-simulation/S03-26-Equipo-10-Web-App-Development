import { IsEmail, IsIn, IsString, Matches } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/, {
    message:
      'Password must contain uppercase, lowercase, number and special character',
  })
  password!: string;

  @IsString()
  @IsIn(['admin', 'editor'])
  role!: 'admin' | 'editor';
}
