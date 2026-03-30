import { Module } from '@nestjs/common';

import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';

import { USER_REPOSITORY } from './repositories/user.repository';
import { PrismaUserRepository } from './repositories/prisma-user.repository';

@Module({
  controllers: [UsersController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    UsersService,
  ],
  exports: [UsersService],
})
export class UsersModule {}
