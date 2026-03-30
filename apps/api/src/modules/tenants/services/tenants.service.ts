import { NotFoundException, ConflictException, Injectable, Inject } from "@nestjs/common";
import { TenantRepository } from "../repositories/tenant.repository";
import { UpdateTenantDto } from "../dto/update-tenant.dto";

@Injectable()
export class TenantsService {
    async getTenant(tenantId: string) {
        const tenant = await this.tenantRepo.findById(tenantId);
        if (!tenant) throw new NotFoundException('Tenant not found');
        return tenant;
    }

    async updateTenant(tenantId: string, dto: UpdateTenantDto) {
        if (dto.name) {
          const nameExists = await this.tenantRepo.nameExists(dto.name, tenantId);
          if (nameExists) throw new ConflictException('Tenant name already exists');
        }

        if (!dto.name) {
          return this.tenantRepo.findById(tenantId);
        }

        return this.tenantRepo.update(tenantId, dto.name);
    }

    constructor(private readonly tenantRepo: TenantRepository) {
    }
}
