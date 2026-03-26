import { Module } from '@nestjs/common';
import { API_KEY_REPOSITORY } from '../../../core/repositories/api-key.repository';
import { PrismaApiKeyRepository } from '../../database/repositories/prisma-api-key.repository';
import { ApiKeysController } from '../controllers/api-keys.controller';
import { ListApiKeysUseCase } from '../../../application/use-cases/list-api-keys.use-case';
import { CreateApiKeyUseCase } from '../../../application/use-cases/create-api-key.use-case';
import { RotateApiKeyUseCase } from '../../../application/use-cases/rotate-api-key.use-case';
import { RevokeApiKeyUseCase } from '../../../application/use-cases/revoke-api-key.use-case';

@Module({
  controllers: [ApiKeysController],
  providers: [
    { provide: API_KEY_REPOSITORY, useClass: PrismaApiKeyRepository },
    ListApiKeysUseCase,
    CreateApiKeyUseCase,
    RotateApiKeyUseCase,
    RevokeApiKeyUseCase,
  ],
  exports: [ListApiKeysUseCase],
})
export class ApiKeysModule {}
