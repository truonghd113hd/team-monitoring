import { TOKEN_KEY } from '@/contexts/AuthContext';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (response.status === 401) {
    // Token expired or revoked — clear storage and redirect
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('invo_auth_user');
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Session expired — please log in again');
  }

  const data = await response.json();

  if (!response.ok) {
    throw new ApiError(response.status, data.message || 'API request failed');
  }

  return data.data ?? data;
}

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers
    }
  });

  return handleResponse<T>(response);
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'GET' });
}

/** Like apiGet but returns the full response body (including pagination meta). */
export async function apiGetFull<T>(endpoint: string): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = getToken();
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  });
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('invo_auth_user');
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Session expired — please log in again');
  }
  const data = await response.json();
  if (!response.ok) throw new ApiError(response.status, data.message || 'API request failed');
  return data as T;
}

export async function apiPost<T>(endpoint: string, body?: any): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(body) });
}

export async function apiPut<T>(endpoint: string, body?: any): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'PUT', body: JSON.stringify(body) });
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  return apiFetch<T>(endpoint, { method: 'DELETE' });
}

export { API_BASE_URL };
