import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

// Domain tokens
import { AUTH_REPOSITORY } from '../../../core/repositories/auth.repository';

// Application ports
import { TOKEN_SERVICE } from '../../../application/ports/token.port';

// Infrastructure adapters
import { PrismaAuthRepository } from '../../database/repositories/prisma-auth.repository';
import { JwtTokenService } from '../../external-services/token/jwt-token.service';

// Application — Use cases
import { RegisterAdminUseCase } from '../../../application/use-cases/register-admin.use-case';
import { LoginUseCase } from '../../../application/use-cases/login.use-case';
import { RefreshSessionUseCase } from '../../../application/use-cases/refresh-session.use-case';
import { LogoutUseCase } from '../../../application/use-cases/logout.use-case';
import { GetMeUseCase } from '../../../application/use-cases/get-me.use-case';

// Application — Services
import { LoginAttemptsService } from '../../../application/services/login-attempts.service';

// Presentation
import { AuthController } from '../controllers/auth.controller';

@Module({
  imports: [JwtModule.register({})],
  controllers: [AuthController],
  providers: [
    // Infrastructure bindings
    { provide: AUTH_REPOSITORY, useClass: PrismaAuthRepository },
    { provide: TOKEN_SERVICE, useClass: JwtTokenService },

    // Use cases
    RegisterAdminUseCase,
    LoginUseCase,
    RefreshSessionUseCase,
    LogoutUseCase,
    GetMeUseCase,

    // Services
    LoginAttemptsService,
  ],
  exports: [JwtModule],
})
export class AuthModule {}
