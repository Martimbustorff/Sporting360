// Figma V7.1 26 Ranking (4943:7761): Header, `Tabs` 'equal' a 8 do Header, linhas `RankingRow` (círculo primary nos três
// primeiros, separadores) e a tua posição fixa em baixo em bg-raised (raio 20). Tudo a 24 dos lados.
// - Top 100 do período em ordem do servidor, empates com a mesma posição (lib/ranking: 1, 2, 2, 4).
// - A linha do próprio fica com " (tu)"; se não está nos 100, linha fixa em baixo com a posição de `fetchMyPosition`.
// - Só nomes públicos (`leaderboards/.../entries`); o ecrã não lê `users` nem `publicProfiles` (nunca email nem "@").
// - Leitura falhada mostra erro, nunca a mensagem de vazio.
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { OfflineBanner } from '@/components/OfflineBanner';
import { RankingRow } from '@/components/RankingRow';
import { Screen } from '@/components/Screen';
import { SwipeTabs } from '@/components/SwipeTabs';
import { Tabs } from '@/components/Tabs';
import { useNow } from '@/data/clock';
import type { LeaderboardEntry } from '@/data/schemas';
import { useMyPosition } from '@/data/myPosition';
import { useLeaderboard, useMyLeaderboardEntry } from '@/data/user';
import { periodKeys } from '@/lib/periods';
import { rankPositions } from '@/lib/ranking';
import { useSession } from '@/providers/SessionProvider';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

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

function Note({ text }: { text: string }) {
  return (
    <Text71 variant="caption12" color="textSubtle" style={{ textAlign: 'center' }}>
      {text}
    </Text71>
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
  const pinned = useMyPosition(kind, key, pinnedPoints);

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
          contentContainerStyle={{ paddingHorizontal: space.s24, paddingBottom: space.s16, gap: space.s8 }}
        >
          <OfflineBanner visible={offline} />
          {rows.length === 0 ? (
            <EmptyState icon="info" text={RANKING_TEXT.empty(kind)} />
          ) : (
            <View>
              {rows.map((r) => (
                <RankingRow key={r.uid} row={r} highlighted={r.uid === uid} />
              ))}
            </View>
          )}
          {notes}
          <Note text={RANKING_TEXT.note} />
        </ScrollView>
        {typeof pinned === 'number' && mineEntry ? (
          <View
            testID="ranking-pinned"
            style={{
              paddingHorizontal: space.s24,
              paddingTop: layout.rankPinnedPadTop,
              paddingBottom: layout.rankPinnedPadBottom,
              borderTopLeftRadius: layout.rankPinnedRadius,
              borderTopRightRadius: layout.rankPinnedRadius,
              backgroundColor: colors.bgRaised,
            }}
          >
            <RankingRow
              last
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
      <View style={{ flex: 1, paddingTop: space.s8, gap: space.s8 }}>
        <View style={{ paddingHorizontal: space.s24 }}>
          <Tabs mode="equal" items={TABS} value={kind} onChange={setKind} />
        </View>
        <SwipeTabs keys={TABS.map((t) => t.key)} value={kind} onChange={setKind}>
          {body}
        </SwipeTabs>
      </View>
    </Screen>
  );
}
