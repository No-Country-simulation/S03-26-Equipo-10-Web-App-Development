import { IsString, Matches, MaxLength, MinLength, IsEmail } from 'class-validator';

export class RegisterAdminDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  tenantName!: string;

  @IsEmail()
  email!: string;

  @IsString()
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,72}$/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  password!: string;
}
