import { Redirect, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { AnalyticsConsentSheet } from '@/components/AnalyticsConsentSheet';
import { peekSignOutNotice } from '@/lib/signOutNotice';
import { BiometricGate } from '@/providers/BiometricGate';
import { useSession } from '@/providers/SessionProvider';
import { getAnalyticsConsent } from '@/services/analytics';

// Task 6: a folha de consentimento de Analytics aparece uma vez, depois de o BiometricGate abrir (é filha dele),
// enquanto não houver escolha guardada. Mudar de ideias é nas Definições (Task 26).
function AnalyticsConsentGate() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    getAnalyticsConsent().then((c) => {
      if (alive && c === null) setShow(true);
    });
    return () => {
      alive = false;
    };
  }, []);
  return show ? <AnalyticsConsentSheet onDone={() => setShow(false)} /> : null;
}

// Guarda: só sessões signedIn entram em (app). `loading` não desenha nada (o splash continua no root).
// O BiometricGate envolve só (app): os ecrãs de (auth) nunca ficam bloqueados.
// R17: um aviso pendente (ex.: conta apagada) segue no redirect para o Welcome, que o mostra e limpa.
export default function AppLayout() {
  const { status } = useSession();
  if (status === 'loading') return null;
  if (status === 'signedOut') {
    const aviso = peekSignOutNotice();
    return <Redirect href={aviso ? { pathname: '/welcome', params: { aviso } } : '/welcome'} />;
  }
  return (
    <BiometricGate>
      <Stack screenOptions={{ headerShown: false }} />
      <AnalyticsConsentGate />
    </BiometricGate>
  );
}
