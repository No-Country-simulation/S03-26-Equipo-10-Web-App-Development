import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { USER_REPOSITORY, IUserRepository } from '../../core/repositories/user.repository';

@Injectable()
export class DeleteUserUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(tenantId: string, userId: string) {
    const user = await this.userRepo.findById(tenantId, userId);
    if (!user) throw new NotFoundException('User not found');

    await this.userRepo.remove(tenantId, userId);
    return { id: userId, deleted: true };
  }
}
