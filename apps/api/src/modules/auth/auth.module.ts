import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { JwtTokenService } from './services/jwt-token.service';
import { LoginAttemptsService } from './services/login-attempts.service';

import { AuthRepository } from './repositories/auth.repository';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    JwtTokenService,
    LoginAttemptsService,
    AuthService,
  ],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}


