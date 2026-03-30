import { Module } from '@nestjs/common';

import { UsersController } from './controllers/users.controller';
import { UsersService } from './services/users.service';

import { UserRepository } from './repositories/user.repository';

@Module({
  controllers: [UsersController],
  providers: [
    UserRepository,
    UsersService,
  ],
  exports: [UsersService],
})
export class UsersModule {}


