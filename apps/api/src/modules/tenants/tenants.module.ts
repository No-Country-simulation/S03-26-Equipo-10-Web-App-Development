import { Module } from '@nestjs/common';
import { TenantsService } from './application/services/tenants.service';
import { TenantsController } from './presentation/controllers/tenants.controller';

@Module({
  controllers: [TenantsController],
  providers: [TenantsService],
  exports: [TenantsService],
})
export class TenantsModule {}
