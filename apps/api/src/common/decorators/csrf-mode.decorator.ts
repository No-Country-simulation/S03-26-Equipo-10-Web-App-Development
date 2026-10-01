import { SetMetadata } from '@nestjs/common';

export const CSRF_MODE_KEY = 'csrf:mode';
export type CsrfMode = 'origin' | 'api-key' | 'refresh';

// Las rutas anónimas comprueban Origin; las rutas con API key no usan cookies de sesión.
export const CsrfMode = (mode: CsrfMode) => SetMetadata(CSRF_MODE_KEY, mode);
