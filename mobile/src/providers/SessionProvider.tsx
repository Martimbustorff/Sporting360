import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged, reload } from '@react-native-firebase/auth';
import { markFreshSession } from '@/lib/lockSession';
import { claimProfileEnsure, clearProfileEnsured } from '@/lib/profileEnsured';
import { authInstance, setAnalyticsUser } from '@/services/firebase';
import { ensureProfile } from '@/services/profile';

export { markProfileEnsured, resetProfileEnsured } from '@/lib/profileEnsured';

export type SessionUser = { uid: string; email: string | null; providers: string[] };
export type Session =
  | { status: 'loading'; user: null }
  | { status: 'signedOut'; user: null }
  | { status: 'signedIn'; user: SessionUser };

const LOADING: Session = { status: 'loading', user: null };
const SessionContext = createContext<Session>(LOADING);

export function useSession(): Session {
  return useContext(SessionContext);
}

// Ligar a Apple (/ligar-apple) não dispara onAuthStateChanged: sem isto as Definições continuavam a mostrar a linha.
const RefreshProvidersContext = createContext<() => Promise<void>>(async () => {});

/** Volta a ler do servidor os métodos de entrada ligados à conta atual (user.reload()) e atualiza a sessão. */
export function useRefreshProviders(): () => Promise<void> {
  return useContext(RefreshProvidersContext);
}

type AuthUser = { uid: string; email: string | null; providerData?: { providerId?: string }[] };

const providerIds = (u: AuthUser) => (u.providerData ?? []).map((p) => p.providerId ?? '').filter(Boolean);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(LOADING);

  useEffect(() => {
    return onAuthStateChanged(authInstance(), (u: AuthUser | null) => {
      if (!u) {
        markFreshSession();
        clearProfileEnsured();
        setAnalyticsUser(null).catch(() => {});
        setSession({ status: 'signedOut', user: null });
        return;
      }
      setSession((prev) =>
        prev.status === 'signedIn' && prev.user.uid === u.uid
          ? prev
          : {
              status: 'signedIn',
              user: {
                uid: u.uid,
                email: u.email ?? null,
                providers: providerIds(u),
              },
            },
      );
      setAnalyticsUser(u.uid).catch(() => {});
      // O Crashlytics nunca recebe o uid (a política de privacidade: relatórios de erro sem identificador da conta).
      // R10: uma vez por uid, e nunca durante um sign-up (signUpEmail trata disso depois de escrever o nome).
      if (claimProfileEnsure(u.uid)) ensureProfile().catch(() => {});
    });
  }, []);

  const refreshProviders = useCallback(async () => {
    const current = authInstance().currentUser;
    if (!current) return;
    await reload(current);
    const u: AuthUser = authInstance().currentUser ?? current;
    const providers = providerIds(u);
    setSession((prev) =>
      prev.status === 'signedIn' && prev.user.uid === u.uid ? { status: 'signedIn', user: { ...prev.user, providers } } : prev,
    );
  }, []);

  const value = useMemo(() => session, [session]);
  return (
    <RefreshProvidersContext.Provider value={refreshProviders}>
      <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
    </RefreshProvidersContext.Provider>
  );
}
