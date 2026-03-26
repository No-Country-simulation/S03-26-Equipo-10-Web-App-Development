import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AUTH_REPOSITORY, IAuthRepository } from '../../core/repositories/auth.repository';
import type { AuthenticatedUser } from '../interfaces/auth-context.interface';

@Injectable()
export class GetMeUseCase {
  constructor(
    @Inject(AUTH_REPOSITORY) private readonly authRepo: IAuthRepository,
  ) {}

  async execute(currentUser: AuthenticatedUser) {
    const user = await this.authRepo.findUserById(currentUser.userId);
    if (!user) throw new NotFoundException('User not found');

    return {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      tenantName: user.tenantName,
      roles: user.roles,
      isActive: user.isActive,
      createdAt: user.createdAt,
    };
  }
}
