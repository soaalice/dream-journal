const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

export class ApiError extends Error {
  status: number;
  /** machine-readable reason sent by the API, for example "suspended" */
  code?: string;
  /** the whole error body, for extra fields such as `reason` */
  data?: Record<string, unknown>;

  constructor(status: number, message: string, data?: Record<string, unknown>) {
    super(message);
    this.status = status;
    this.data = data;
    this.code = typeof data?.code === 'string' ? data.code : undefined;
  }
}

type UnauthorizedHandler = (error: ApiError) => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** Registered by AuthProvider so an expired session logs the user out everywhere. */
export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  onUnauthorized = handler;
};

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  /** Skip the global 401 handler (used by login, where 401 means bad credentials). */
  skipAuthHandler?: boolean;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal, skipAuthHandler } = options;

  const params = new URLSearchParams();
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();

  const response = await fetch(`${API_URL}${path}${qs ? `?${qs}` : ''}`, {
    method,
    credentials: 'include',
    signal,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const error = new ApiError(response.status, data?.message ?? 'Request failed', data ?? undefined);
    if (response.status === 401 && !skipAuthHandler) onUnauthorized?.(error);
    throw error;
  }
  return data as T;
}
