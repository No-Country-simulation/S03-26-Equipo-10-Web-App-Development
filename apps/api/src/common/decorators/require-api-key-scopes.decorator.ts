import { SetMetadata } from '@nestjs/common';
import type { ApiKeyScope } from '../services/api-key-crypto.service';

export const API_KEY_SCOPES_KEY = 'api-key-scopes';
export const RequireApiKeyScopes = (...scopes: ApiKeyScope[]) => SetMetadata(API_KEY_SCOPES_KEY, scopes);
