import { Inject, Injectable } from '@nestjs/common';
import { USER_REPOSITORY, IUserRepository } from '../../core/repositories/user.repository';

@Injectable()
export class ListUsersUseCase {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
  ) {}

  async execute(tenantId: string) {
    const users = await this.userRepo.findByTenant(tenantId);
    return {
      items: users,
      meta: { total: users.length, page: 1, limit: users.length },
    };
  }
}
