import { API_BASE_URL, appPath } from './config';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  token: string;
  role?: 'user' | 'admin';
}

export const getStoredUser = (): AuthUser | null => {
  const stored = localStorage.getItem('user');
  if (!stored) return null;

  try {
    const user = JSON.parse(stored);
    if (!user?.token) return null;
    return user;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: AuthUser) => {
  localStorage.setItem('user', JSON.stringify(user));
};

export const syncStoredUserRole = (role: AuthUser['role']) => {
  const stored = getStoredUser();
  if (!stored || !role || stored.role === role) return;
  setStoredUser({ ...stored, role });
};

export const isAdminUser = (user?: { role?: string } | null) =>
  user?.role === 'admin';

export const clearStoredUser = () => {
  localStorage.removeItem('user');
};

const buildHeaders = (extra?: HeadersInit): HeadersInit => {
  const user = getStoredUser();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(extra as Record<string, string>),
  };

  if (user?.token) {
    headers.Authorization = `Bearer ${user.token}`;
  }

  return headers;
};

export const authFetch = async (path: string, options: RequestInit = {}) => {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: buildHeaders(options.headers),
  });

  if (res.status === 401) {
    clearStoredUser();
    window.location.assign(appPath('/login'));
    throw new Error('Session expired');
  }

  return res;
};

export const parseErrorMessage = async (res: Response, fallback: string) => {
  try {
    const data = await res.json();
    return data.message || fallback;
  } catch {
    return fallback;
  }
};
