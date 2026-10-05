import { applyDecorators } from '@nestjs/common';
import { ApiHeader, ApiResponse } from '@nestjs/swagger';

/** Documents routes that call IdempotencyService explicitly. */
export const Idempotent = () => applyDecorators(
  ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Optional retry key. The same actor, route and payload replay the original 201/202 response for 24 hours.',
  }),
  ApiResponse({ status: 400, description: 'Invalid Idempotency-Key (Problem Details).' }),
  ApiResponse({ status: 409, description: 'Reused key with different payload or request in progress (Problem Details).' }),
);
