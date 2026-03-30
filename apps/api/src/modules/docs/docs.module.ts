import { Module } from '@nestjs/common';

import { DocsController } from './controllers/docs.controller';

@Module({
  controllers: [DocsController],
})
export class DocsModule {}
