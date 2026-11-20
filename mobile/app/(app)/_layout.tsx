import { Redirect, Stack, useGlobalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { AnalyticsConsentSheet } from '@/components/AnalyticsConsentSheet';
import { GoalCelebration } from '@/components/GoalCelebration';
import { setPendingLink } from '@/lib/pendingLink';
import { peekSignOutNotice } from '@/lib/signOutNotice';
import { BiometricGate } from '@/providers/BiometricGate';
import { PushSetup } from '@/providers/PushSetup';
import { useSession } from '@/providers/SessionProvider';
import { getAnalyticsConsent } from '@/services/analytics';

// Task 6: a folha de consentimento de Analytics aparece uma vez, depois de o BiometricGate abrir (é filha dele),
// enquanto não houver escolha guardada. Mudar de ideias é nas Definições (Task 26).
// Plano 6: `onSettled` avisa quando a folha fecha ou não é precisa (o pedido de notificações vem depois).
function AnalyticsConsentGate({ onSettled }: { onSettled: () => void }) {
  const router = useRouter();
  const [show, setShow] = useState(false);
  useEffect(() => {
    let alive = true;
    getAnalyticsConsent()
      .then((c) => {
        if (!alive) return;
        if (c === null) setShow(true);
        else onSettled();
      })
      .catch(() => {
        if (alive) onSettled();
      });
    return () => {
      alive = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- corre uma vez ao montar, onSettled muda de identidade a cada render
  }, []);
  // A página de privacidade abre por cima: a folha fica escondida (mas montada, a escolha continua pendente) enquanto lá está.
  const onTerms = usePathname().includes('/definicoes/termos');
  return show && !onTerms ? (
    <AnalyticsConsentSheet
      onPrivacy={() => router.push('/definicoes/termos')}
      onDone={() => {
        setShow(false);
        onSettled();
      }}
    />
  ) : null;
}

// Guarda: só sessões signedIn entram em (app). `loading` não desenha nada (o splash continua no root).
// O BiometricGate envolve só (app): os ecrãs de (auth) nunca ficam bloqueados.
// R17: um aviso pendente (ex.: conta apagada) segue no redirect para o Welcome, que o mostra e limpa.
// Plano 8, Task 6: sem sessão, o caminho tentado (/e/{id} ou /j, nada mais) fica guardado (lib/pendingLink) e o guarda de
// (auth) abre-o depois de entrar. No /j leva também a query (game, src), que o caminho não traz. Os hooks de caminho e
// parâmetros ficam só neste ramo, para o layout com sessão não re-renderizar a cada mudança de parâmetros.
function SignedOutRedirect() {
  const pathname = usePathname();
  const query = useGlobalSearchParams<{ game?: string | string[]; src?: string | string[] }>();
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const search = new URLSearchParams();
  if (pathname === '/j') {
    const game = first(query.game);
    const src = first(query.src);
    if (src) search.set('src', src);
    if (game) search.set('game', game);
  }
  setPendingLink(search.size ? `${pathname}?${search.toString()}` : pathname);
  const aviso = peekSignOutNotice();
  return <Redirect href={aviso ? { pathname: '/welcome', params: { aviso } } : '/welcome'} />;
}

export default function AppLayout() {
  const { status, user } = useSession();
  const [consentSettled, setConsentSettled] = useState(false);
  if (status === 'loading') return null;
  if (status === 'signedOut') return <SignedOutRedirect />;
  return (
    <BiometricGate>
      <Stack screenOptions={{ headerShown: false }} />
      {/* Plano 10: golo do Sporting com a app aberta, por cima de qualquer ecrã. */}
      <GoalCelebration />
      <AnalyticsConsentGate onSettled={() => setConsentSettled(true)} />
      <PushSetup uid={user.uid} ready={consentSettled} />
    </BiometricGate>
  );
}
