import { Module } from '@nestjs/common';

import { ApiKeysController } from './controllers/api-keys.controller';
import { ApiKeysService } from './services/api-keys.service';

import { API_KEY_REPOSITORY } from './repositories/api-key.repository';
import { PrismaApiKeyRepository } from './repositories/prisma-api-key.repository';

@Module({
  controllers: [ApiKeysController],
  providers: [
    { provide: API_KEY_REPOSITORY, useClass: PrismaApiKeyRepository },
    ApiKeysService,
  ],
  exports: [ApiKeysService],
})
export class ApiKeysModule {}
