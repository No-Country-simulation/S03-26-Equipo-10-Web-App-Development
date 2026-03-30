import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { JwtTokenService } from './services/jwt-token.service';
import { LoginAttemptsService } from './services/login-attempts.service';

import { AUTH_REPOSITORY } from './repositories/auth.repository';
import { PrismaAuthRepository } from './repositories/prisma-auth.repository';

import { TOKEN_SERVICE } from './interfaces/token.port';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },
    LoginAttemptsService,
    AuthService,
  ],
  exports: [JwtModule, AuthService],
})
export class AuthModule {}
