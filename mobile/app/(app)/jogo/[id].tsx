// Figma: nós 500:28956 (cabeçalho do jogo futuro com a barra de tabs), 655:31868 (o mesmo ao vivo,
// com as caixas de resultado) e 500:28976 (barra de tabs com scroll). O cabeçalho é o `GameHeader`
// da Task 4 e a barra é o `Tabs mode="scroll"` do Plano 3; aqui só se compõe o ecrã.
// SEM FIGMA: as sete tabs (o Figma só desenha quatro: Sumário, Estatísticas, Formações e
// Classificações; Vídeos, Prognóstico e MVP vêm das imagens da página "Appstore S360"), o detalhe
// das outras modalidades (spec 5.6: só cabeçalho com local, Competição, Data e Local), o esqueleto
// de carregamento, o aviso de cache (OfflineBanner) e a linha "Fonte: ...".
// O cabeçalho e as tabs ficam fixos no topo; cada tab trata do seu scroll (Tasks 9 a 18).
import { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { GameHeader } from '@/components/GameHeader';
import { Header } from '@/components/Header';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { InfoRow } from '@/components/SectionBar';
import { Tabs } from '@/components/Tabs';
import { LineupsTab } from '@/components/match/LineupsTab';
import { MvpTab } from '@/components/match/MvpTab';
import { PredictionTab } from '@/components/match/PredictionTab';
import { StandingsTab } from '@/components/match/StandingsTab';
import { StatsTab } from '@/components/match/StatsTab';
import { SummaryTab } from '@/components/match/SummaryTab';
import { VideosTab } from '@/components/match/VideosTab';
import { useNow } from '@/data/clock';
import type { Match } from '@/data/schemas';
import { useMatch } from '@/data/sports';
import { competitionText, toGameHeaderVM } from '@/lib/matchVM';
import { MONTHS_SHORT, formatTime, lisbonParts } from '@/lib/ptDate';
import { sportLabel } from '@/lib/sports';
import { Body } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

export type MatchTabKey =
  | 'sumario'
  | 'videos'
  | 'estatisticas'
  | 'formacoes'
  | 'classificacao'
  | 'prognostico'
  | 'mvp';

/** Tabs do detalhe de um jogo de futebol, por esta ordem. As outras modalidades não têm tabs. */
export const FOOTBALL_TABS: { key: MatchTabKey; label: string }[] = [
  { key: 'sumario', label: 'Sumário' },
  { key: 'videos', label: 'Vídeos' },
  { key: 'estatisticas', label: 'Estatísticas' },
  { key: 'formacoes', label: 'Formações' },
  { key: 'classificacao', label: 'Classificação' },
  { key: 'prognostico', label: 'Prognóstico' },
  { key: 'mvp', label: 'MVP' },
];

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

/** SEM FIGMA: data completa da linha "Data", em Lisboa ("14 Set 2026, 20:30"). */
function fullDate(d: Date): string {
  const p = lisbonParts(d);
  return `${p.day} ${MONTHS_SHORT[p.month - 1]} ${p.year}, ${formatTime(d)}`;
}

/** SEM FIGMA: enquanto o jogo não chega, um bloco com a altura do cabeçalho. */
function Skeleton() {
  return (
    <View style={{ paddingHorizontal: spacing.screenX, paddingTop: spacing.md }}>
      <View
        testID="jogo-skeleton"
        style={{
          height: layout.skeletonHeaderHeight,
          borderRadius: radius.md,
          backgroundColor: colors.surface10,
        }}
      />
    </View>
  );
}

/** Outras modalidades (spec 5.6): só cabeçalho com resultado, competição, data e local. */
function OtherSportDetail({ match, now }: { match: Match; now: Date }) {
  const vm = toGameHeaderVM(match);
  const competition = vm.round ? `${vm.competitionName}, ${vm.round}` : vm.competitionName;
  const venue = match.venue;
  const attribution = match.source.attribution;
  return (
    <ScrollView contentContainerStyle={{ paddingVertical: spacing.md, gap: spacing.md }}>
      <GameHeader game={vm} now={now} />
      <View style={{ paddingHorizontal: spacing.screenX }}>
        <InfoRow label="Competição" value={competition} />
        <InfoRow label="Data" value={fullDate(match.kickoff)} />
        {venue ? (
          <InfoRow label="Local" value={venue.city ? `${venue.name}, ${venue.city}` : venue.name} />
        ) : null}
      </View>
      {attribution ? (
        <Body variant="body" style={{ textAlign: 'center', opacity: layout.mutedOpacity }}>
          {`Fonte: ${attribution}`}
        </Body>
      ) : null}
    </ScrollView>
  );
}

function FootballDetail({ match, now, initialTab }: { match: Match; now: Date; initialTab: MatchTabKey }) {
  const [tab, setTab] = useState<MatchTabKey>(initialTab);
  const ActiveTab = TAB_VIEWS[tab];
  return (
    <View style={{ flex: 1, paddingTop: spacing.md, gap: spacing.md }}>
      <GameHeader
        game={toGameHeaderVM(match)}
        now={now}
        tabs={<Tabs mode="scroll" items={FOOTBALL_TABS} value={tab} onChange={setTab} />}
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
  const now = useNow();
  const loadable = useMatch(id);
  const match = loadable.status === 'ready' ? loadable.data : null;

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  // Futebol: nome da competição no Header; outras modalidades: nome da modalidade (spec 5.6).
  const title = match
    ? match.sport === 'football'
      ? competitionText(match.competition).name
      : sportLabel(match.sport)
    : 'Jogo';

  return (
    <Screen padded="none">
      <Header title={title} onBack={back} />
      <OfflineBanner visible={loadable.status === 'ready' && loadable.fromCache === true} />
      {loadable.status === 'loading' ? (
        <Skeleton />
      ) : loadable.status === 'missing' ? (
        <EmptyState icon="info" text={MISSING_TEXT} />
      ) : !match ? (
        // Sem documento e sem "missing" só sobra o erro (listener ou documento inválido).
        <EmptyState icon="info" text={ERROR_TEXT} />
      ) : match.sport === 'football' ? (
        <FootballDetail match={match} now={now} initialTab={initialTab} />
      ) : (
        <OtherSportDetail match={match} now={now} />
      )}
    </Screen>
  );
}
