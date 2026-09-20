/**
 * Envoltorio estándar (envelope) devuelto por el interceptor `ApiResponseInterceptor` del backend.
 */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface SessionPayload {
  user: {
    id: string;
    email: string;
    tenantId: string;
    tenantName: string;
    roles: string[];
    isActive: boolean;
    createdAt: string;
  };
  tokens: {
    accessToken: string;
    refreshToken: string;
  };
}

export interface TenantUser {
  id: string;
  email: string;
  tenantId: string;
  isActive: boolean;
  createdAt: string;
  roles: string[];
}

export interface Category {
  id: string;
  name: string;
  tenantId: string;
}

export interface Tag {
  id: string;
  name: string;
  tenantId: string;
}

export interface TestimonialRecord {
  id: string;
  authorName: string;
  content: string;
  rating: number;
  status: string;
  score: number;
  createdAt: string;
  publishedAt?: string | null;
  categoryId?: string | null;
  category?: { id: string; name: string } | null;
  tags?: { id: string; name: string }[];
  imageUrl?: string | null;
  videoUrl?: string | null;
  videoTitle?: string | null;
  videoThumbnailUrl?: string | null;
}

/**
 * Error personalizado para manejar respuestas fallidas de la API de manera consistente.
 *
 * H-15: Acepta `ErrorOptions` para encadenar la causa original (`{ cause: originalError }`).
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'ApiError';
  }
}

export function getApiBaseUrl() {
  const configured = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';

  if (configured.endsWith('/api/v1')) {
    return configured;
  }

  if (configured.endsWith('/api')) {
    return `${configured}/v1`;
  }

  return configured;
}

/**
 * Type guard para verificar que un valor desconocido tiene la forma de un ApiEnvelope.
 * H-07: Valida la estructura mínima del envelope antes del casteo a `ApiEnvelope<T>`.
 */
function isApiEnvelope(value: unknown): value is ApiEnvelope<unknown> {
  return (
    value !== null &&
    typeof value === 'object' &&
    'success' in value &&
    typeof (value as Record<string, unknown>).success === 'boolean'
  );
}

/**
 * Cliente de API base para llamadas tipadas desde Next.js al backend NestJS.
 * Construye la URL base y envuelve las respuestas en el tipo `ApiEnvelope<T>`.
 *
 * @param path Ruta del endpoint (ej. `/auth/login`).
 * @param init Opciones de Fetch API (método, headers, body, etc).
 * @throws {ApiError} Si la respuesta del servidor no es OK (ej. 4xx, 5xx) o el formato es inesperado.
 * @returns La carga útil de la respuesta parseada y tipada.
 */
export async function requestApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<ApiEnvelope<T>> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });

  const raw: unknown = await response.json();

  if (!response.ok) {
    // Extraer el error del envelope si la respuesta tiene la forma esperada
    const errorPayload = isApiEnvelope(raw) ? (raw as { error?: { message?: string; code?: string } }) : null;
    throw new ApiError(
      errorPayload?.error?.message ?? 'Unexpected error',
      errorPayload?.error?.code,
      response.status,
    );
  }

  // H-07: Validar que el servidor devolvió un envelope válido antes de castearlo
  if (!isApiEnvelope(raw)) {
    throw new ApiError(
      'Unexpected API response format — el servidor no devolvió un envelope válido.',
      'INVALID_RESPONSE',
      response.status,
    );
  }

  return raw as ApiEnvelope<T>;
}
