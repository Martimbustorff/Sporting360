// Jogo no ecrã de bloqueio (Plano 10, ponto 2; só iPhone). Montado no layout com sessão: regista os tokens, guarda
// os emblemas do próximo jogo e, com o jogo a meio, arranca a atividade se o servidor não a arrancou. Ao voltar
// à app volta a ler as atividades (uma que o servidor arrancou com a app fechada só aqui dá o token).
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { useNow } from '@/data/clock';
import { useHomeMatches, useMatchDetail } from '@/data/sports';
import { pickHomeMatch } from '@/lib/homeMatchMoment';
import { cacheCrests, liveActivitySupported, startIfMissing, watchActivities, watchPushToStart } from '@/services/liveActivity';

function Setup({ uid }: { uid: string }) {
  const minute = useNow(60_000);
  const matches = useHomeMatches(minute);
  const match = useMemo(() => (matches.status === 'ready' ? pickHomeMatch(matches.data, minute) : null), [matches, minute]);
  const live = match !== null && (match.status === 'LIVE' || match.status === 'HT');
  const events = useMatchDetail(live ? match.id : null, 'events');
  const [active, setActive] = useState(0);

  useEffect(() => watchPushToStart(uid), [uid]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') setActive((n) => n + 1);
    });
    return () => sub.remove();
  }, []);

  const matchId = match?.id ?? null;
  useEffect(() => {
    if (match) void cacheCrests(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez por jogo
  }, [matchId]);

  useEffect(() => {
    if (!match || !live) return undefined;
    startIfMissing(match, events.status === 'ready' ? events.data.items : [], new Date());
    return watchActivities(uid, match.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ao mudar de jogo, ao começar e ao voltar à app
  }, [uid, matchId, live, active]);

  return null;
}

export function LiveActivitySetup({ uid }: { uid: string }) {
  return liveActivitySupported() ? <Setup uid={uid} /> : null;
}
