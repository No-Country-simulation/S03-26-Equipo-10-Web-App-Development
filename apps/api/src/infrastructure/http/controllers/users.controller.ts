import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentTenantId } from '../decorators/current-tenant.decorator';
import { Roles } from '../decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { CreateUserDto, UpdateUserDto } from '../../../application/dtos/user.dto';
import { ListUsersUseCase } from '../../../application/use-cases/list-users.use-case';
import { GetUserUseCase } from '../../../application/use-cases/get-user.use-case';
import { CreateUserUseCase } from '../../../application/use-cases/create-user.use-case';
import { UpdateUserUseCase } from '../../../application/use-cases/update-user.use-case';
import { DeleteUserUseCase } from '../../../application/use-cases/delete-user.use-case';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(
    private readonly listUsers: ListUsersUseCase,
    private readonly getUser: GetUserUseCase,
    private readonly createUser: CreateUserUseCase,
    private readonly updateUser: UpdateUserUseCase,
    private readonly deleteUser: DeleteUserUseCase,
  ) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.listUsers.execute(tenantId);
  }

  @Get(':user_id')
  getOne(
    @CurrentTenantId() tenantId: string,
    @Param('user_id') userId: string,
  ) {
    return this.getUser.execute(tenantId, userId);
  }

  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateUserDto,
  ) {
    return this.createUser.execute(tenantId, dto);
  }

  @Patch(':user_id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('user_id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.updateUser.execute(tenantId, userId, dto);
  }

  @Delete(':user_id')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('user_id') userId: string,
  ) {
    return this.deleteUser.execute(tenantId, userId);
  }
}
