import { Module } from '@nestjs/common';
import { ApiKeysService } from './application/services/api-keys.service';
import { ApiKeysController } from './presentation/controllers/api-keys.controller';

@Module({
  controllers: [ApiKeysController],
  providers: [ApiKeysService],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
