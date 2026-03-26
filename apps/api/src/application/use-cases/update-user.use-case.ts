import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USER_REPOSITORY, IUserRepository } from '../../core/repositories/user.repository';
import { PasswordService } from '../../infrastructure/external-services/hashing/password.service';
import { UpdateUserDto } from '../dtos/user.dto';

@Injectable()
export class UpdateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly passwordService: PasswordService,
  ) {}

  async execute(tenantId: string, userId: string, dto: UpdateUserDto) {
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
}
