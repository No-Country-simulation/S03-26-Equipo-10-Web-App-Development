import { ConflictError, NotFoundError } from '../../../common/errors/application.error';
import { Injectable } from '@nestjs/common';
import { UserRepository } from "../repositories/user.repository";
import { PasswordService } from '../../shared/hashing';
import { CreateUserDto, UpdateUserDto } from "../dto/user.dto";
import type { AdminPage } from '../../../common/pagination/admin-page';

/**
 * Servicio encargado de la gestión de usuarios.
 * Contiene la lógica de negocio para crear, listar, actualizar y eliminar usuarios
 * manteniendo el aislamiento por Tenant.
 */
@Injectable()
export class UsersService {
    /**
     * Crea un nuevo usuario en la base de datos tras verificar que el email no exista.
     * @param tenantId ID del tenant al que pertenecerá el usuario.
     * @param dto DTO con los datos del usuario (email, password, rol).
     * @throws {ConflictError} Si el email ya está registrado.
     */
    async createUser(tenantId: string, dto: CreateUserDto) {
        const existing = await this.userRepo.findByEmail(dto.email);
        if (existing) throw new ConflictError('Email already exists');

        const passwordHash = await this.passwordService.hashPassword(dto.password);

        return this.userRepo.create({
          tenantId,
          email: dto.email,
          passwordHash,
          roleCode: dto.role ?? 'editor', // Otorga el rol editor por defecto
        });
    }

    /**
     * Elimina permanentemente a un usuario asegurando que pertenezca al tenant correcto.
     * @param tenantId ID del tenant.
     * @param userId ID del usuario a eliminar.
     * @throws {NotFoundError} Si el usuario no existe o no pertenece al tenant.
     */
    async deleteUser(tenantId: string, userId: string) {
        const user = await this.userRepo.findById(tenantId, userId);
        if (!user) throw new NotFoundError('User not found');

        await this.userRepo.remove(tenantId, userId);
        return { id: userId, deleted: true };
    }

    /**
     * Retorna la información de un usuario específico.
     * @param tenantId ID del tenant.
     * @param userId ID del usuario.
     * @throws {NotFoundError} Si el usuario no existe.
     */
    async getUser(tenantId: string, userId: string) {
        const user = await this.userRepo.findById(tenantId, userId);
        if (!user) throw new NotFoundError('User not found');
        return user;
    }

    /**
     * Lista todos los usuarios de un tenant y los envuelve en un objeto paginado estandarizado.
     * @param tenantId ID del tenant a consultar.
     */
    async listUsers(tenantId: string, page: AdminPage = { page: 1, limit: 20 }) {
        const { items, total } = await this.userRepo.findByTenant(tenantId, page);
        return {
          items,
          meta: { total, page: page.page, limit: page.limit },
        };
    }

    /**
     * Actualiza atributos de un usuario. Si se provee una nueva contraseña, esta es hasheada antes de guardar.
     * @param tenantId ID del tenant.
     * @param userId ID del usuario a modificar.
     * @param dto Campos a actualizar.
     * @throws {NotFoundError} Si el usuario no existe.
     */
    async updateUser(tenantId: string, userId: string, dto: UpdateUserDto) {
        const user = await this.userRepo.findById(tenantId, userId);
        if (!user) throw new NotFoundError('User not found');

        let passwordHash: string | undefined;
        if (dto.password) {
          passwordHash = await this.passwordService.hashPassword(dto.password);
        }

        return this.userRepo.update({
          tenantId,
          userId,
          ...(passwordHash !== undefined && { passwordHash }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        });
    }

    constructor(private readonly userRepo: UserRepository, private readonly passwordService: PasswordService) {
    }
}
