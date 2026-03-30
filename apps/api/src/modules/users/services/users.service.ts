import { ConflictException, NotFoundException, Injectable, Inject } from "@nestjs/common";
import { UserRepository } from "../repositories/user.repository";
import { PasswordService } from "../../shared/hashing/password.service";
import { CreateUserDto, UpdateUserDto } from "../dto/user.dto";

@Injectable()
export class UsersService {
    async createUser(tenantId: string, dto: CreateUserDto) {
        const existing = await this.userRepo.findByEmail(dto.email);
        if (existing) throw new ConflictException('Email already exists');

        const passwordHash = await this.passwordService.hashPassword(dto.password);

        return this.userRepo.create({
          tenantId,
          email: dto.email,
          passwordHash,
          roleCode: dto.role ?? 'editor',
        });
    }

    async deleteUser(tenantId: string, userId: string) {
        const user = await this.userRepo.findById(tenantId, userId);
        if (!user) throw new NotFoundException('User not found');

        await this.userRepo.remove(tenantId, userId);
        return { id: userId, deleted: true };
    }

    async getUser(tenantId: string, userId: string) {
        const user = await this.userRepo.findById(tenantId, userId);
        if (!user) throw new NotFoundException('User not found');
        return user;
    }

    async listUsers(tenantId: string) {
        const users = await this.userRepo.findByTenant(tenantId);
        return {
          items: users,
          meta: { total: users.length, page: 1, limit: users.length },
        };
    }

    async updateUser(tenantId: string, userId: string, dto: UpdateUserDto) {
        const user = await this.userRepo.findById(tenantId, userId);
        if (!user) throw new NotFoundException('User not found');

        let passwordHash: string | undefined;
        if (dto.password) {
          passwordHash = await this.passwordService.hashPassword(dto.password);
        }

        return this.userRepo.update({
          tenantId,
          userId,
          passwordHash,
          isActive: dto.isActive,
        });
    }

    constructor(private readonly userRepo: UserRepository, private readonly passwordService: PasswordService) {
    }
}
