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
import { CurrentTenantId } from '../../../../common/decorators/current-tenant.decorator';
import { Roles } from '../../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../../common/guards/roles.guard';
import { CreateUserDto, UpdateUserDto } from '../../application/dto/user.dto';
import { UsersService } from '../../application/services/users.service';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.usersService.listUsers(tenantId);
  }

  @Get(':user_id')
  getOne(
    @CurrentTenantId() tenantId: string,
    @Param('user_id') userId: string,
  ) {
    return this.usersService.getUser(tenantId, userId);
  }

  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.createUser(tenantId, dto);
  }

  @Patch(':user_id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('user_id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(tenantId, userId, dto);
  }

  @Delete(':user_id')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('user_id') userId: string,
  ) {
    return this.usersService.deleteUser(tenantId, userId);
  }
}
