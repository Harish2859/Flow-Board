import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api, setToken, type UserProfile } from './api';

interface AuthCtx {
  user: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const Ctx = createContext<AuthCtx>({
  user: null,
  loading: true,
  signIn: async () => {},
  signUp: async () => {},
  signOut: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('fb_token');
    if (!token) { setLoading(false); return; }
    api.me()
      .then(setUser)
      .catch(() => setToken(null))
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (email: string, password: string) => {
    const { token, user } = await api.login(email, password);
    setToken(token);
    setUser(user);
  };

  const signUp = async (email: string, password: string) => {
    const { token, user } = await api.signup(email, password);
    setToken(token);
    setUser(user);
  };

  const signOut = () => {
    setToken(null);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, signIn, signUp, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
