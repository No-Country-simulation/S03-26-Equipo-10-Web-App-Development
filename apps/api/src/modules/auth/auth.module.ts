import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CommonModule } from '../../common/common.module';
import { AuthService } from './application/services/auth.service';
import { AuthController } from './presentation/controllers/auth.controller';

@Module({
  imports: [JwtModule.register({}), CommonModule],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
