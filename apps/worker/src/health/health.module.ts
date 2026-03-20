import { Module } from '@nestjs/common';

/**
 * Purpose: Expose worker health capabilities when the worker becomes an active service.
 * Responsibilities: Compose the future providers, controllers and infrastructure bindings for this module.
 * Inputs: Provider declarations, controllers and module imports.
 * Outputs: A NestJS module boundary ready for incremental implementation.
 * Dependencies: NestJS decorators and the future module internals defined in this folder.
 * Implementation notes: Keep this module empty until the legacy runtime is migrated to the new structure.
 * Naming and boundaries: Respect the clean architecture boundary represented by this folder.
 */
@Module({})
export class HealthModule {}
