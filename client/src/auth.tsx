import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

interface AuthUser {
  id: string;
  username: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('slideo-token');
    if (!token) { setIsLoading(false); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setUser({ id: data.id, username: data.username }); })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) throw new Error('Invalid credentials');
    const data = await res.json();
    localStorage.setItem('slideo-token', data.token);
    setUser({ id: data.id ?? '', username: data.username });
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error ?? 'Registration failed');
    }
    const data = await res.json();
    localStorage.setItem('slideo-token', data.token);
    setUser({ id: data.id, username: data.username });
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    localStorage.removeItem('slideo-token');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function getAuthHeaders(): Record<string, string> {
  const token = localStorage.getItem('slideo-token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export function storeEditToken(presentationId: string, editToken: string) {
  const raw = localStorage.getItem('slideo-edit-tokens');
  const map: Record<string, string> = raw ? JSON.parse(raw) : {};
  map[presentationId] = editToken;
  localStorage.setItem('slideo-edit-tokens', JSON.stringify(map));
}

export function getEditToken(presentationId: string): string | null {
  const raw = localStorage.getItem('slideo-edit-tokens');
  if (!raw) return null;
  const map: Record<string, string> = JSON.parse(raw);
  return map[presentationId] ?? null;
}

export function storeShareToken(presentationId: string, shareToken: string) {
  const raw = localStorage.getItem('slideo-share-tokens');
  const map: Record<string, string> = raw ? JSON.parse(raw) : {};
  map[presentationId] = shareToken;
  localStorage.setItem('slideo-share-tokens', JSON.stringify(map));
}

export function getShareToken(presentationId: string): string | null {
  const raw = localStorage.getItem('slideo-share-tokens');
  if (!raw) return null;
  const map: Record<string, string> = JSON.parse(raw);
  return map[presentationId] ?? null;
}
