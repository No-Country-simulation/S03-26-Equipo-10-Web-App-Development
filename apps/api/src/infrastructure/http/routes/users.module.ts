import { Module } from '@nestjs/common';
import { USER_REPOSITORY } from '../../../core/repositories/user.repository';
import { PrismaUserRepository } from '../../database/repositories/prisma-user.repository';
import { ListUsersUseCase } from '../../../application/use-cases/list-users.use-case';
import { GetUserUseCase } from '../../../application/use-cases/get-user.use-case';
import { CreateUserUseCase } from '../../../application/use-cases/create-user.use-case';
import { UpdateUserUseCase } from '../../../application/use-cases/update-user.use-case';
import { DeleteUserUseCase } from '../../../application/use-cases/delete-user.use-case';
import { UsersController } from '../controllers/users.controller';

@Module({
  controllers: [UsersController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    ListUsersUseCase,
    GetUserUseCase,
    CreateUserUseCase,
    UpdateUserUseCase,
    DeleteUserUseCase,
  ],
  exports: [GetUserUseCase],
})
export class UsersModule {}
