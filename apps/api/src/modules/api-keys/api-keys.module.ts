import { Module } from '@nestjs/common';

import { ApiKeysController } from './controllers/api-keys.controller';
import { ApiKeysService } from './services/api-keys.service';

import { ApiKeyRepository } from './repositories/api-key.repository';

@Module({
  controllers: [ApiKeysController],
  providers: [
    ApiKeyRepository,
    ApiKeysService,
  ],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}


