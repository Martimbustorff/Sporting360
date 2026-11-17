import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from '@react-native-firebase/auth';
import { getCrashlytics, setUserId as setCrashlyticsUserId } from '@react-native-firebase/crashlytics';
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

type AuthUser = { uid: string; email: string | null; providerData?: { providerId?: string }[] };

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(LOADING);

  useEffect(() => {
    return onAuthStateChanged(authInstance(), (u: AuthUser | null) => {
      if (!u) {
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
                providers: (u.providerData ?? []).map((p) => p.providerId ?? '').filter(Boolean),
              },
            },
      );
      setAnalyticsUser(u.uid).catch(() => {});
      try {
        void setCrashlyticsUserId(getCrashlytics(), u.uid);
      } catch {
        // telemetria nunca bloqueia
      }
      // R10: uma vez por uid, e nunca durante um sign-up (signUpEmail trata disso depois de escrever o nome).
      if (claimProfileEnsure(u.uid)) ensureProfile().catch(() => {});
    });
  }, []);

  const value = useMemo(() => session, [session]);
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
