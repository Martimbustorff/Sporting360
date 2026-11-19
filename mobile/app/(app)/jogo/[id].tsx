// Figma V7.1: 06 (4924:6268, cabeçalho completo ao vivo), 29 (4945:7833, antes do jogo), 08 (4933:7057, compacto com os
// separadores fixos), 10 (4935:7111) e 34 (4947:9606, outra modalidade, sem separadores). O cabeçalho é o `GameHeader`; a
// barra de separadores é o `Tabs mode="scroll"` e fica fixa por baixo; o conteúdo de cada separador trata do seu scroll e
// avisa o cabeçalho (`useMatchScroll`), que fecha para a linha compacta.
// SEM FIGMA: o esqueleto de carregamento, o aviso de cache (OfflineBanner) e a linha "Fonte: ...". O sino do Figma não
// existe hoje neste ecrã (nenhuma ação), por isso não se desenha. Ao vivo, os pontos do cartão do prognóstico só aparecem
// com os eventos de pontos do servidor.
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { GameHeader, GameNavTitle, type GameHeaderVM } from '@/components/GameHeader';
import { Header } from '@/components/Header';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { Tabs } from '@/components/Tabs';
import { CollapsingHeader, CrossfadeCenter } from '@/components/match/CollapsingHeader';
import { LineupsTab } from '@/components/match/LineupsTab';
import { MatchScrollProvider, useMatchScrollContext } from '@/components/match/MatchScroll';
import { MvpTab } from '@/components/match/MvpTab';
import { PredictionTab } from '@/components/match/PredictionTab';
import { StandingsTab } from '@/components/match/StandingsTab';
import { StatsTab } from '@/components/match/StatsTab';
import { SummaryTab } from '@/components/match/SummaryTab';
import { VideosTab } from '@/components/match/VideosTab';
import type { Match } from '@/data/schemas';
import { useMatch, useMatchDetail } from '@/data/sports';
import { useMyGamePoints, useMyPrediction, useSettlement } from '@/data/user';
import { FOOTBALL_TABS, type MatchTabKey } from '@/lib/matchTabs';
import { goalsFromEvents, toGameHeaderVM } from '@/lib/matchVM';
import { predictionPoints } from '@/lib/predictionPoints';
import { sportLabel } from '@/lib/sports';
import { useSession } from '@/providers/SessionProvider';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

/* eslint-disable @typescript-eslint/no-require-imports */
const LUZ = require('../../../assets/images/match-luz.svg') as number;
const RINGS = require('../../../assets/images/welcome-rings.svg') as number;
/* eslint-enable @typescript-eslint/no-require-imports */

const TAB_VIEWS: Record<MatchTabKey, (props: { match: Match }) => React.JSX.Element> = {
  sumario: SummaryTab,
  videos: VideosTab,
  estatisticas: StatsTab,
  formacoes: LineupsTab,
  classificacao: StandingsTab,
  prognostico: PredictionTab,
  mvp: MvpTab,
};

const MISSING_TEXT = 'Jogo não encontrado.';
const ERROR_TEXT = 'Não foi possível carregar o jogo.';

const param = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

function tabFromParam(v: string | undefined): MatchTabKey {
  return FOOTBALL_TABS.some((t) => t.key === v) ? (v as MatchTabKey) : 'sumario';
}

/** SEM FIGMA: enquanto o jogo não chega, um bloco com a altura do cabeçalho. */
function Skeleton() {
  return (
    <View style={{ paddingHorizontal: space.s16, paddingTop: space.s16 }}>
      <View
        testID="jogo-skeleton"
        style={{
          height: layout.skeletonHeaderHeight,
          borderRadius: radii.r8,
          backgroundColor: colors.surface10,
        }}
      />
    </View>
  );
}

/** Luz verde atrás do resultado e anéis da marca a 22 % (4924:6269 e 4924:6270), por baixo de tudo. */
function MatchBackdrop() {
  const { width, height, top } = layout.matchLuz;
  const rings = layout.matchRings;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: layout.matchBackdropHeight, overflow: 'hidden' }}>
      <Image source={LUZ} accessible={false} style={{ position: 'absolute', left: '50%', marginLeft: -width / 2, top, width, height }} />
      <Image
        source={RINGS}
        accessible={false}
        style={{ position: 'absolute', left: '50%', marginLeft: -rings.size / 2, top: rings.top, width: rings.size, height: rings.size, opacity: rings.opacity }}
      />
    </View>
  );
}

/** Futebol: competição no centro da barra e, com o scroll, o resultado compacto (4933:7267). */
function FootballNav({ match, onBack }: { match: Match; onBack: () => void }) {
  const vm = toGameHeaderVM(match);
  return (
    <Header
      title={vm.competitionName}
      onBack={onBack}
      center={<CrossfadeCenter title={<GameNavTitle game={vm} />} compact={<GameHeader game={vm} size="compact" />} />}
    />
  );
}

/** Dados do cabeçalho completo: golos (marcadores e linha do tempo) e o prognóstico do utilizador, se existir. */
function useFootballHeaderVM(match: Match): GameHeaderVM {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const events = useMatchDetail(match.id, 'events');
  const prediction = useMyPrediction(match.id, uid);
  const settlement = useSettlement(match.id);
  const points = useMyGamePoints(match.id, uid);
  const goals = events.status === 'ready' ? events.data.items : null;
  const pick = prediction.status === 'ready' ? prediction.data : null;
  const settledPoints =
    settlement.status === 'ready' && points.status === 'ready' ? predictionPoints(points.data) : null;
  return useMemo(
    () => ({
      ...toGameHeaderVM(match),
      goals: goals ? goalsFromEvents(goals, match.home.id) : [],
      prediction: pick ? { home: pick.home, away: pick.away, points: settledPoints } : null,
    }),
    [match, goals, pick, settledPoints],
  );
}

/** Outras modalidades (spec 5.6, frame 34): só cabeçalho (competição, data, hora e local), sem separadores. */
function OtherSportDetail({ match }: { match: Match }) {
  const vm = toGameHeaderVM(match);
  const attribution = match.source.attribution;
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: space.s16, gap: space.s16 }}>
      <GameHeader game={vm} />
      {attribution ? (
        <Text71 variant="body14" color="textMuted" style={{ textAlign: 'center' }}>
          {`Fonte: ${attribution}`}
        </Text71>
      ) : null}
    </ScrollView>
  );
}

function FootballDetail({ match, initialTab }: { match: Match; initialTab: MatchTabKey }) {
  const [tab, setTab] = useState<MatchTabKey>(initialTab);
  const scroll = useMatchScrollContext();
  const header = useFootballHeaderVM(match);
  const ActiveTab = TAB_VIEWS[tab];
  return (
    <View style={{ flex: 1 }}>
      <CollapsingHeader>
        <GameHeader game={header} />
      </CollapsingHeader>
      <Tabs
        mode="scroll"
        items={FOOTBALL_TABS}
        value={tab}
        onChange={(k) => {
          // Cada separador tem o seu scroll: ao mudar, o cabeçalho volta a abrir.
          scroll?.reset();
          setTab(k);
        }}
      />
      <View style={{ flex: 1 }}>
        <ActiveTab match={match} />
      </View>
    </View>
  );
}

export default function Jogo() {
  const params = useLocalSearchParams<{ id?: string | string[]; tab?: string | string[] }>();
  const id = param(params.id) ?? null;
  const initialTab = tabFromParam(param(params.tab));
  const loadable = useMatch(id);
  const match = loadable.status === 'ready' ? loadable.data : null;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const football = match?.sport === 'football';

  return (
    <Screen padded="none">
      <MatchBackdrop />
      <MatchScrollProvider>
        {match && football ? (
          <FootballNav match={match} onBack={back} />
        ) : (
          <Header
            title={match ? sportLabel(match.sport) : 'Jogo'}
            onBack={back}
            center={match ? <GameNavTitle game={toGameHeaderVM(match)} /> : undefined}
          />
        )}
        <OfflineBanner visible={loadable.status === 'ready' && loadable.fromCache === true} />
        {loadable.status === 'loading' ? (
          <Skeleton />
        ) : loadable.status === 'missing' ? (
          <EmptyState icon="info" text={MISSING_TEXT} />
        ) : !match ? (
          // Sem documento e sem "missing" só sobra o erro (listener ou documento inválido).
          <EmptyState icon="info" text={ERROR_TEXT} />
        ) : football ? (
          <FootballDetail match={match} initialTab={initialTab} />
        ) : (
          <OtherSportDetail match={match} />
        )}
      </MatchScrollProvider>
    </Screen>
  );
}
