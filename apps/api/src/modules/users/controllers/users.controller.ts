import { UsersService } from '../services/users.service';
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
import { CurrentTenantId } from '../../../common/decorators/current-tenant.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';

/**
 * Controlador de Usuarios.
 * Proporciona endpoints para gestionar los usuarios de un Tenant específico.
 * Solo accesible por usuarios autenticados con rol de administrador.
 */
@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  /**
   * Obtiene la lista de todos los usuarios pertenecientes al tenant actual.
   * @param tenantId ID del tenant extraído del token del usuario autenticado.
   */
  @Get()
  list(@CurrentTenantId() tenantId: string) {
    return this.usersService.listUsers(tenantId);
  }

  /**
   * Obtiene la información detallada de un usuario específico.
   * @param tenantId ID del tenant actual.
   * @param userId ID del usuario a consultar.
   */
  @Get(':user_id')
  getOne(
    @CurrentTenantId() tenantId: string,
    @Param('user_id') userId: string,
  ) {
    return this.usersService.getUser(tenantId, userId);
  }

  /**
   * Crea un nuevo usuario dentro del tenant actual.
   * @param tenantId ID del tenant actual.
   * @param dto Datos del usuario a crear.
   */
  @Post()
  create(
    @CurrentTenantId() tenantId: string,
    @Body() dto: CreateUserDto,
  ) {
    return this.usersService.createUser(tenantId, dto);
  }

  /**
   * Actualiza la información de un usuario existente (ej. desactivarlo o cambiar contraseña).
   * @param tenantId ID del tenant actual.
   * @param userId ID del usuario a actualizar.
   * @param dto Campos a actualizar.
   */
  @Patch(':user_id')
  update(
    @CurrentTenantId() tenantId: string,
    @Param('user_id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.updateUser(tenantId, userId, dto);
  }

  /**
   * Elimina a un usuario del sistema (Hard delete o Soft delete dependiendo del repositorio).
   * @param tenantId ID del tenant actual.
   * @param userId ID del usuario a eliminar.
   */
  @Delete(':user_id')
  remove(
    @CurrentTenantId() tenantId: string,
    @Param('user_id') userId: string,
  ) {
    return this.usersService.deleteUser(tenantId, userId);
  }
}
