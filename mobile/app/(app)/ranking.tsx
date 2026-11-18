// SEM FIGMA: o Figma não tem frame do Ranking (Mapa do Figma do Plano 4: "Notícias, Ranking, Perfil"; referência
// raster: nenhuma específica, só o `RankingRow` aprovado na galeria, Plano 3). Compõe `Header`, `Tabs` 'equal'
// (500:28814, Semana, Mês, Época), `RankingRow` (círculo da posição 500:29423) e `OfflineBanner`; o resto com tokens.
// - Top 100 do período em ordem do servidor, empates com a mesma posição (lib/ranking: 1, 2, 2, 4).
// - A linha do próprio fica destacada; se não está nos 100, linha fixa em baixo com a posição de `fetchMyPosition`.
// - Só nomes públicos (`leaderboards/.../entries`); o ecrã não lê `users` nem `publicProfiles` (nunca email nem "@").
// - Leitura falhada mostra erro, nunca a mensagem de vazio.
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { OfflineBanner } from '@/components/OfflineBanner';
import { RankingRow } from '@/components/RankingRow';
import { Screen } from '@/components/Screen';
import { Tabs } from '@/components/Tabs';
import { useNow } from '@/data/clock';
import type { LeaderboardEntry } from '@/data/schemas';
import { fetchMyPosition, useLeaderboard, useMyLeaderboardEntry } from '@/data/user';
import { periodKeys } from '@/lib/periods';
import { rankPositions } from '@/lib/ranking';
import { useSession } from '@/providers/SessionProvider';
import { Body } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';

type Kind = 'week' | 'month' | 'season';

const TABS: { key: Kind; label: string }[] = [
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'season', label: 'Época' },
];
const PERIOD_TEXT: Record<Kind, string> = { week: 'nesta semana', month: 'neste mês', season: 'nesta época' };

export const RANKING_TEXT = {
  error: 'Não foi possível carregar o ranking.',
  mineError: 'Não foi possível carregar a tua posição.',
  note: 'Contam os pontos de prognósticos e votos MVP, na data do jogo.',
  empty: (kind: Kind) => `Ainda não há pontos ${PERIOD_TEXT[kind]}.`,
  noneYet: (kind: Kind) => `Ainda não pontuaste ${PERIOD_TEXT[kind]}.`,
} as const;

/** Posição do próprio quando está fora dos 100: contagem no servidor; `error` se a contagem falhar. */
function usePinnedPosition(kind: Kind, key: string, points: number | null): number | 'error' | null {
  const [state, setState] = useState<{ id: string; value: number | 'error' } | null>(null);
  const id = points === null ? null : `${kind}_${key}_${points}`;
  useEffect(() => {
    if (id === null || points === null) return undefined;
    let cancelled = false;
    fetchMyPosition(kind, key, points).then(
      (value) => {
        if (!cancelled) setState({ id, value });
      },
      () => {
        if (!cancelled) setState({ id, value: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, kind, key, points]);
  return id !== null && state?.id === id ? state.value : null;
}

function Note({ text }: { text: string }) {
  return (
    <Body variant="body" style={{ textAlign: 'center', color: colors.textMuted }}>
      {text}
    </Body>
  );
}

export default function Ranking() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const now = useNow();
  const keys = periodKeys(now);
  const [kind, setKind] = useState<Kind>('week');
  const key = keys[kind];

  const board = useLeaderboard(kind, key);
  const mine = useMyLeaderboardEntry(kind, key, uid);

  const list: LeaderboardEntry[] = board.status === 'ready' ? board.data : [];
  const rows = rankPositions(list);
  const mineEntry = mine.status === 'ready' ? mine.data : null;
  const inList = uid !== null && list.some((e) => e.uid === uid);
  const pinnedPoints = board.status === 'ready' && mineEntry !== null && !inList ? mineEntry.points : null;
  const pinned = usePinnedPosition(kind, key, pinnedPoints);

  let body: React.JSX.Element;
  if (board.status === 'loading') {
    body = <View testID="ranking-loading" style={{ flex: 1 }} />;
  } else if (board.status === 'error') {
    body = <EmptyState icon="info" text={RANKING_TEXT.error} />;
  } else {
    const offline = board.status === 'ready' && board.fromCache === true;
    const notes: React.JSX.Element[] = [];
    // Com a linha própria já visível não há nota sobre a entrada própria.
    if (uid !== null && !inList) {
      if (mine.status === 'error' || pinned === 'error') notes.push(<Note key="mine-error" text={RANKING_TEXT.mineError} />);
      else if (mine.status === 'missing' && rows.length > 0) notes.push(<Note key="none-yet" text={RANKING_TEXT.noneYet(kind)} />);
    }
    body = (
      <>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingBottom: spacing.md, gap: spacing.sm }}
        >
          <OfflineBanner visible={offline} />
          {rows.length === 0 ? (
            <EmptyState icon="info" text={RANKING_TEXT.empty(kind)} />
          ) : (
            rows.map((r) => <RankingRow key={r.uid} row={r} highlighted={r.uid === uid} />)
          )}
          {notes}
          <Note text={RANKING_TEXT.note} />
        </ScrollView>
        {typeof pinned === 'number' && mineEntry ? (
          <View
            testID="ranking-pinned"
            style={{
              paddingHorizontal: spacing.screenX,
              paddingTop: spacing.sm,
              borderTopWidth: layout.separator,
              borderTopColor: colors.divider,
              backgroundColor: colors.bg,
            }}
          >
            <RankingRow
              row={{ position: pinned, uid: mineEntry.uid, displayName: mineEntry.displayName, points: mineEntry.points }}
              highlighted
            />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <Screen padded="none">
      <Header title="Ranking" onBack={back} />
      <View style={{ flex: 1, paddingTop: spacing.md, gap: spacing.md }}>
        <View style={{ paddingHorizontal: spacing.screenX }}>
          <Tabs mode="equal" items={TABS} value={kind} onChange={setKind} />
        </View>
        {body}
      </View>
    </Screen>
  );
}
