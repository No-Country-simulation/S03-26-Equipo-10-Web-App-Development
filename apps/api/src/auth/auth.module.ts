import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminGuard } from '../common/guards/admin.guard';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginAttemptsService } from './login-attempts.service';
import { PasswordService } from './password.service';

@Module({
  imports: [JwtModule.register({}), PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, LoginAttemptsService, JwtAuthGuard, AdminGuard],
  exports: [AuthService, PasswordService, JwtAuthGuard, AdminGuard, JwtModule],
})
export class AuthModule {}
