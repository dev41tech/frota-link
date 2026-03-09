import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import { api, type ApiUser, type ApiSession } from '@/lib/apiClient';
import { useSessionTimeout } from './useSessionTimeout';
import { SessionTimeoutWarning } from '@/components/auth/SessionTimeoutWarning';
import { useDomainRouting } from './useDomainRouting';

// ─── Tipos compatíveis com o que o restante do app espera ───────────────────
// Mantemos a mesma interface de User para não quebrar nenhum arquivo existente
export type User = ApiUser & {
  user_metadata: Record<string, any>;
};

export type Session = ApiSession & {
  user: User;
};

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDriverUser, setIsDriverUser] = useState(false);

  const { isMasterDomain } = useDomainRouting();

  const checkIfDriver = useCallback(async (userId: string) => {
    try {
      const { data } = await api
        .from('drivers')
        .select('id')
        .eq('auth_user_id', userId)
        .eq('status', 'active')
        .maybeSingle();
      setIsDriverUser(!!data);
    } catch {
      setIsDriverUser(false);
    }
  }, []);

  // Configuração de timeout por perfil
  const timeoutConfig = isDriverUser
    ? {
        idleTimeout: 4 * 60 * 60 * 1000,
        absoluteTimeout: 72 * 60 * 60 * 1000,
        warningBefore: 5 * 60 * 1000,
      }
    : isMasterDomain
    ? {
        idleTimeout: 15 * 60 * 1000,
        absoluteTimeout: 4 * 60 * 60 * 1000,
        warningBefore: 2 * 60 * 1000,
      }
    : {
        idleTimeout: 30 * 60 * 1000,
        absoluteTimeout: 8 * 60 * 60 * 1000,
        warningBefore: 2 * 60 * 1000,
      };

  const handleSessionTimeout = async () => {
    console.log('Session timeout – logging out');
    await signOut();
  };

  const { showWarning, timeLeft, extendSession, clearSessionTimestamp, resetSessionTimestamp } =
    useSessionTimeout({ onTimeout: handleSessionTimeout, ...timeoutConfig });

  useEffect(() => {
    // Ouvir mudanças de auth do apiClient
    const { data: { subscription } } = api.auth.onAuthStateChange((event, sess) => {
      if (event === 'SIGNED_IN' && sess) {
        const apiUser = sess.user as User;
        apiUser.user_metadata = apiUser.user_metadata || { full_name: (apiUser as any).full_name };
        setUser(apiUser);
        setSession(sess as Session);
        resetSessionTimestamp();
        setTimeout(() => checkIfDriver(apiUser.id), 0);
      }

      if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        clearSessionTimestamp();
        setIsDriverUser(false);
      }

      setLoading(false);
    });

    // Restaurar sessão inicial do localStorage
    api.auth.getSession().then(({ data: { session: sess } }) => {
      if (sess) {
        const apiUser = sess.user as User;
        apiUser.user_metadata = apiUser.user_metadata || { full_name: (apiUser as any).full_name };
        setUser(apiUser);
        setSession(sess as Session);
        checkIfDriver(apiUser.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    const { error } = await api.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await api.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signOut = async () => {
    try {
      setLoading(true);
      clearSessionTimestamp();
      await api.auth.signOut();
    } catch (e) {
      console.error('Erro ao deslogar:', e);
    } finally {
      setSession(null);
      setUser(null);

      // Limpar dados locais
      try {
        Object.keys(localStorage).forEach(k => {
          if (k.startsWith('frota_') || k.startsWith('sb-') || k.startsWith('linkfrota_')) {
            localStorage.removeItem(k);
          }
        });
      } catch {}
      try { sessionStorage.clear(); } catch {}

      window.location.replace('/');
      setTimeout(() => window.location.reload(), 50);
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut }}>
      {children}
      {user && (
        <SessionTimeoutWarning
          open={showWarning}
          timeLeft={timeLeft}
          onExtend={extendSession}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
