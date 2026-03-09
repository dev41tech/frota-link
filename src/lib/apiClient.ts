/**
 * apiClient.ts
 * Cliente HTTP que substitui o @supabase/supabase-js.
 * Expõe interface compatível (from().select/insert/update/delete + auth.*)
 * para minimizar mudanças no restante do codebase.
 */

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// ─── Token management ────────────────────────────────────────────────────────
const TOKEN_KEY = 'frota_access_token';
const REFRESH_KEY = 'frota_refresh_token';
const USER_KEY = 'frota_user';

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function setTokens(access: string, refresh?: string) {
  localStorage.setItem(TOKEN_KEY, access);
  if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
}

function clearTokens() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

// ─── Base fetch with auto-refresh ────────────────────────────────────────────
async function apiFetch(path: string, init: RequestInit = {}): Promise<any> {
  const token = getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let res = await fetch(`${API_BASE}${path}`, { ...init, headers });

  // Auto-refresh on 401
  if (res.status === 401) {
    const refreshToken = localStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      const refreshRes = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (refreshRes.ok) {
        const { access_token } = await refreshRes.json();
        setTokens(access_token);
        // Retry original request
        res = await fetch(`${API_BASE}${path}`, {
          ...init,
          headers: { ...headers, Authorization: `Bearer ${access_token}` },
        });
      } else {
        clearTokens();
        window.location.replace('/');
        return;
      }
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  return res.json().catch(() => null);
}

// ─── Auth state listeners ─────────────────────────────────────────────────────
type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'TOKEN_REFRESHED';
type AuthListener = (event: AuthEvent, session: ApiSession | null) => void;
const authListeners: AuthListener[] = [];

export interface ApiUser {
  id: string;
  email: string;
  full_name?: string;
  role?: string;
  company_id?: string;
  user_metadata?: Record<string, any>;
}

export interface ApiSession {
  access_token: string;
  refresh_token?: string;
  user: ApiUser;
}

function notifyListeners(event: AuthEvent, session: ApiSession | null) {
  authListeners.forEach(l => l(event, session));
}

// ─── QueryBuilder (compatível com supabase-js) ───────────────────────────────

interface QueryResult<T> {
  data: T | null;
  error: Error | null;
}

type FilterValue = string | number | boolean | null;

class QueryBuilder<T = any> {
  private _table: string;
  private _select: string = '*';
  private _filters: Array<{ field: string; op: string; value: FilterValue }> = [];
  private _order: string | null = null;
  private _limit: number | null = null;
  private _offset: number | null = null;
  private _single: boolean = false;
  private _method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET';
  private _body: any = null;
  private _id: string | null = null;

  constructor(table: string) {
    this._table = table;
  }

  select(fields?: string): this {
    this._select = fields || '*';
    this._method = 'GET';
    return this;
  }

  insert(data: any | any[]): this {
    this._method = 'POST';
    this._body = Array.isArray(data) ? data[0] : data;
    return this;
  }

  update(data: any): this {
    this._method = 'PUT';
    this._body = data;
    return this;
  }

  delete(): this {
    this._method = 'DELETE';
    return this;
  }

  eq(field: string, value: FilterValue): this {
    this._filters.push({ field, op: 'eq', value });
    return this;
  }

  neq(field: string, value: FilterValue): this {
    this._filters.push({ field, op: 'neq', value });
    return this;
  }

  gt(field: string, value: FilterValue): this {
    this._filters.push({ field, op: 'gt', value });
    return this;
  }

  gte(field: string, value: FilterValue): this {
    this._filters.push({ field, op: 'gte', value });
    return this;
  }

  lt(field: string, value: FilterValue): this {
    this._filters.push({ field, op: 'lt', value });
    return this;
  }

  lte(field: string, value: FilterValue): this {
    this._filters.push({ field, op: 'lte', value });
    return this;
  }

  like(field: string, value: string): this {
    this._filters.push({ field, op: 'like', value });
    return this;
  }

  ilike(field: string, value: string): this {
    this._filters.push({ field, op: 'ilike', value });
    return this;
  }

  in(field: string, values: FilterValue[]): this {
    this._filters.push({ field, op: 'in', value: values as any });
    return this;
  }

  is(field: string, value: null | boolean): this {
    this._filters.push({ field, op: 'is', value });
    return this;
  }

  not(field: string, op: string, value: FilterValue): this {
    this._filters.push({ field, op: `not.${op}`, value });
    return this;
  }

  order(field: string, opts?: { ascending?: boolean }): this {
    this._order = opts?.ascending === false ? `-${field}` : field;
    return this;
  }

  limit(n: number): this {
    this._limit = n;
    return this;
  }

  range(from: number, to: number): this {
    this._offset = from;
    this._limit = to - from + 1;
    return this;
  }

  single(): this {
    this._single = true;
    this._limit = 1;
    return this;
  }

  maybeSingle(): this {
    this._single = true;
    this._limit = 1;
    return this;
  }

  // Suporte a .eq().id (para UPDATE/DELETE por ID)
  private extractId(): void {
    const idFilter = this._filters.find(f => f.field === 'id');
    if (idFilter) {
      this._id = String(idFilter.value);
      this._filters = this._filters.filter(f => f.field !== 'id');
    }
  }

  private buildQueryString(): string {
    const params = new URLSearchParams();
    for (const f of this._filters) {
      if (f.op === 'eq') {
        // Filtros simples: ?field=value ou ?eq[field]=value
        params.append(`eq[${f.field}]`, String(f.value ?? ''));
      } else if (f.op === 'in' && Array.isArray(f.value)) {
        params.append(`in[${f.field}]`, (f.value as any[]).join(','));
      } else if (f.op === 'is') {
        params.append(`is[${f.field}]`, String(f.value));
      } else {
        params.append(`${f.op}[${f.field}]`, String(f.value ?? ''));
      }
    }
    if (this._order) params.append('order', this._order);
    if (this._limit !== null) params.append('limit', String(this._limit));
    if (this._offset !== null) params.append('offset', String(this._offset));
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  async then(
    resolve: (value: QueryResult<T extends any[] ? T : T[]>) => any,
    reject?: (reason: any) => any
  ): Promise<any> {
    try {
      const result = await this.execute();
      return resolve(result as any);
    } catch (e) {
      if (reject) return reject(e);
      throw e;
    }
  }

  async execute(): Promise<QueryResult<any>> {
    try {
      this.extractId();
      let path = `/${this._table}`;
      if (this._id) path += `/${this._id}`;

      if (this._method === 'GET') {
        const qs = this.buildQueryString();
        const data = await apiFetch(`${path}${qs}`);
        if (this._single) {
          const item = Array.isArray(data) ? data[0] ?? null : data;
          return { data: item, error: null };
        }
        return { data: Array.isArray(data) ? data : (data ? [data] : []), error: null };
      }

      if (this._method === 'POST') {
        const data = await apiFetch(path, {
          method: 'POST',
          body: JSON.stringify(this._body),
        });
        return { data, error: null };
      }

      if (this._method === 'PUT') {
        if (!this._id) {
          // Fallback: filtrar por eq filters - não suportado via CRUD genérico
          throw new Error('UPDATE precisa de .eq("id", value)');
        }
        const data = await apiFetch(path, {
          method: 'PUT',
          body: JSON.stringify(this._body),
        });
        return { data, error: null };
      }

      if (this._method === 'DELETE') {
        if (!this._id) throw new Error('DELETE precisa de .eq("id", value)');
        await apiFetch(path, { method: 'DELETE' });
        return { data: null, error: null };
      }

      return { data: null, error: new Error('Método desconhecido') };
    } catch (e: any) {
      return { data: null, error: e };
    }
  }
}

// ─── RPC stub (compatibilidade) ──────────────────────────────────────────────
async function rpc(fnName: string, params?: Record<string, any>): Promise<QueryResult<any>> {
  try {
    const data = await apiFetch(`/rpc/${fnName}`, {
      method: 'POST',
      body: JSON.stringify(params || {}),
    });
    return { data, error: null };
  } catch (e: any) {
    return { data: null, error: e };
  }
}

// ─── Storage stub (compatibilidade) ──────────────────────────────────────────
const storage = {
  from: (bucket: string) => ({
    upload: async (path: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('bucket', bucket);
      fd.append('path', path);
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/storage/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      const data = await res.json().catch(() => ({}));
      return { data: res.ok ? data : null, error: res.ok ? null : new Error(data.error) };
    },
    getPublicUrl: (path: string) => ({
      data: { publicUrl: `${API_BASE}/storage/${bucket}/${path}` },
    }),
    download: async (path: string) => {
      const token = getAccessToken();
      const res = await fetch(`${API_BASE}/storage/${bucket}/${path}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const blob = await res.blob();
      return { data: blob, error: null };
    },
    remove: async (paths: string[]) => {
      await apiFetch(`/storage/remove`, {
        method: 'POST',
        body: JSON.stringify({ bucket, paths }),
      });
      return { data: null, error: null };
    },
  }),
};

// ─── Functions stub (Edge Functions → backend endpoints) ─────────────────────
const functions = {
  invoke: async (fnName: string, opts?: { body?: any }) => {
    try {
      const data = await apiFetch(`/functions/${fnName}`, {
        method: 'POST',
        body: JSON.stringify(opts?.body || {}),
      });
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  },
};

// ─── Auth interface ───────────────────────────────────────────────────────────
const auth = {
  onAuthStateChange: (callback: (event: string, session: ApiSession | null) => void) => {
    authListeners.push(callback as AuthListener);

    // Disparar estado inicial
    const token = getAccessToken();
    if (token) {
      const userStr = localStorage.getItem(USER_KEY);
      const user = userStr ? JSON.parse(userStr) : null;
      if (user) {
        setTimeout(() => callback('SIGNED_IN', { access_token: token, user }), 0);
      }
    } else {
      setTimeout(() => callback('SIGNED_OUT', null), 0);
    }

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            const idx = authListeners.indexOf(callback as AuthListener);
            if (idx > -1) authListeners.splice(idx, 1);
          },
        },
      },
    };
  },

  getSession: async () => {
    const token = getAccessToken();
    if (!token) return { data: { session: null }, error: null };
    const userStr = localStorage.getItem(USER_KEY);
    const user = userStr ? JSON.parse(userStr) : null;
    return { data: { session: token ? { access_token: token, user } : null }, error: null };
  },

  getUser: async () => {
    const token = getAccessToken();
    if (!token) return { data: { user: null }, error: null };
    try {
      const data = await apiFetch('/auth/me');
      return { data: { user: data.user }, error: null };
    } catch (e: any) {
      return { data: { user: null }, error: e };
    }
  },

  signInWithPassword: async ({ email, password }: { email: string; password: string }) => {
    try {
      const data = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setTokens(data.access_token, data.refresh_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));

      // Montar session compatível com Supabase
      const session: ApiSession = {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user: {
          ...data.user,
          id: data.user.id,
          email: data.user.email,
          user_metadata: { full_name: data.user.full_name },
        },
      };

      notifyListeners('SIGNED_IN', session);
      return { data: { session, user: session.user }, error: null };
    } catch (e: any) {
      return { data: { session: null, user: null }, error: e };
    }
  },

  signUp: async ({ email, password, options }: { email: string; password: string; options?: any }) => {
    try {
      const data = await apiFetch('/auth/signup', {
        method: 'POST',
        body: JSON.stringify({ email, password, full_name: options?.data?.full_name }),
      });
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  },

  signOut: async () => {
    try {
      const refreshToken = localStorage.getItem(REFRESH_KEY);
      await apiFetch('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refresh_token: refreshToken }),
      }).catch(() => {});
    } finally {
      clearTokens();
      notifyListeners('SIGNED_OUT', null);
    }
    return { error: null };
  },

  updateUser: async (updates: any) => {
    try {
      const data = await apiFetch('/auth/update', { method: 'PUT', body: JSON.stringify(updates) });
      return { data, error: null };
    } catch (e: any) {
      return { data: null, error: e };
    }
  },

  resetPasswordForEmail: async (email: string) => {
    try {
      await apiFetch('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email }) });
      return { error: null };
    } catch (e: any) {
      return { error: e };
    }
  },
};

// ─── Canal (compatibilidade Realtime – no-op no MySQL) ───────────────────────
const channel = (_name: string) => ({
  on: (_event: string, _filter: any, _cb: any) => channel(_name),
  subscribe: (_cb?: any) => ({ unsubscribe: () => {} }),
  unsubscribe: () => {},
});

// ─── Export principal (compatível com supabase-js) ───────────────────────────
export const api = {
  from: <T = any>(table: string) => new QueryBuilder<T>(table),
  auth,
  storage,
  functions,
  rpc,
  channel,
  // Helpers extras para uso direto
  fetch: apiFetch,
};

export default api;
