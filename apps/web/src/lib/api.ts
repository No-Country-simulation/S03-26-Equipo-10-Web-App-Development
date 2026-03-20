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

export interface TestimonialRecord {
  id: string;
  authorName: string;
  content: string;
  rating: number;
  status: string;
  score: number;
  createdAt: string;
  publishedAt?: string | null;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1';
}

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

  const payload = await response.json();

  if (!response.ok) {
    throw new ApiError(
      payload?.error?.message ?? 'Unexpected error',
      payload?.error?.code,
      response.status,
    );
  }

  return payload as ApiEnvelope<T>;
}
