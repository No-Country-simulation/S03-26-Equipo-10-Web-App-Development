import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { JwtTokenService } from './services/jwt-token.service';
import { LoginAttemptsService } from './services/login-attempts.service';

import { AuthRepository } from './repositories/auth.repository';
import type { AppConfig } from '../../config/app.config';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<AppConfig>('app')!.jwt.secret,
      }),
    }),
  ],
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


