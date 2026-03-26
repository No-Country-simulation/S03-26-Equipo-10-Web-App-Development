import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { TENANT_REPOSITORY, ITenantRepository } from '../../core/repositories/tenant.repository';
import { UpdateTenantDto } from '../dtos/update-tenant.dto';

@Injectable()
export class UpdateTenantUseCase {
  constructor(
    @Inject(TENANT_REPOSITORY) private readonly tenantRepo: ITenantRepository,
  ) {}

  async execute(tenantId: string, dto: UpdateTenantDto) {
    if (dto.name) {
      const nameExists = await this.tenantRepo.nameExists(dto.name, tenantId);
      if (nameExists) throw new ConflictException('Tenant name already exists');
    }

    if (!dto.name) {
      return this.tenantRepo.findById(tenantId);
    }

    return this.tenantRepo.update(tenantId, dto.name);
  }
}
