import { Prisma } from '@prisma/client';
import {
  ApplicationError,
  ConflictError,
  NotFoundError,
} from '../../../common/errors/application.error';
export function rethrowCatalogWrite(error: unknown): never {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002')
      throw new ApplicationError(
        'Catalog name already exists',
        'conflict',
        'CATALOG_NAME_TAKEN',
      );
    if (error.code === 'P2025')
      throw new NotFoundError('Catalog entry not found');
    if (error.code === 'P2003')
      throw new ConflictError(
        'Catalog associations changed; refresh before retrying',
      );
  }
  throw error;
}
