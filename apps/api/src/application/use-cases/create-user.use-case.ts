import { Inject, Injectable, ConflictException } from '@nestjs/common';
import { USER_REPOSITORY, IUserRepository } from '../../core/repositories/user.repository';
import { PasswordService } from '../../infrastructure/external-services/hashing/password.service';
import { CreateUserDto } from '../dtos/user.dto';

@Injectable()
export class CreateUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly passwordService: PasswordService,
  ) {}

  async execute(tenantId: string, dto: CreateUserDto) {
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
}
