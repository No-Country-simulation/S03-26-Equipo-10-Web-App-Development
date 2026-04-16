import { NotFoundException, ConflictException, Injectable } from "@nestjs/common";
import { TenantRepository } from "../repositories/tenant.repository";
import { UpdateTenantDto } from "../dto/update-tenant.dto";

@Injectable()
export class TenantsService {
    async getTenant(tenantId: string) {
        const tenant = await this.tenantRepo.findById(tenantId);
        if (!tenant) throw new NotFoundException('Tenant not found');
        return tenant;
    }

    async getTenantByPublicSlug(slug: string) {
        const tenant = await this.tenantRepo.findByPublicSlug(slug);
        if (!tenant) throw new NotFoundException('Tenant not found by slug');
        return tenant;
    }

    async updateTenant(tenantId: string, dto: UpdateTenantDto) {
        if (dto.name) {
          const nameExists = await this.tenantRepo.nameExists(dto.name, tenantId);
          if (nameExists) throw new ConflictException('Tenant name already exists');
        }

        if (dto.publicSlug) {
          const slugExists = await this.tenantRepo.slugExists(dto.publicSlug, tenantId);
          if (slugExists) throw new ConflictException('Public slug already in use by another tenant');
        }

        if (Object.keys(dto).length === 0) {
          return this.tenantRepo.findById(tenantId);
        }

        return this.tenantRepo.update(tenantId, {
          name: dto.name,
          publicSlug: dto.publicSlug,
          isPublicFormEnabled: dto.isPublicFormEnabled,
        });
    }

    constructor(private readonly tenantRepo: TenantRepository) {
    }
}
