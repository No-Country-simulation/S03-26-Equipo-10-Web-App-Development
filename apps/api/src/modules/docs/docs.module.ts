import { Module } from '@nestjs/common';
import { DocsController } from './presentation/controllers/docs.controller';

@Module({
  controllers: [DocsController],
})
export class DocsModule {}
