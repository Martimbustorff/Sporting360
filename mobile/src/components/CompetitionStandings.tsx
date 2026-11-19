// Figma V7.1: 4935:7111 (Classificação ao vivo: alternador Ao vivo / Oficial 4935:7280, nota 4935:7286, tabela em `StandingsTable`);
// seletor Tabela/Eliminatórias com `Tabs` (modo 'equal'). Conteúdo a 24 de cada lado (4935:7279), 12 entre blocos.
// Ao vivo: `competitions/{key}/data/liveFixtures` (escrito pelo servidor a cada minuto durante um jogo do Sporting em liga). O
// alternador só aparece com jogos ao vivo e o documento com menos de 5 min (`liveStandingsAvailable`); abre em "Ao vivo" e a
// escolha vale enquanto o ecrã está montado. Sem documento, velho ou em erro: só a tabela oficial, sem alternador.
// SEM FIGMA: o seletor "Tabela"/"Eliminatórias" (só quando há as duas vistas), o quadro (`BracketView`), o esqueleto
// em branco enquanto carrega, o erro, "Sem classificação para esta competição.", o aviso de cache e a ligação
// "Ver competição" (Body tab a primary, centrada, alvo de toque de 44 px).
// A vista abre pela escolha do utilizador, depois por `competitions/{key}.view.primary` (que muda em direto de
// `table` para `bracket` a meio da época, Review Focus 5). A escolha guarda-se por competição até a app reiniciar
// (`setViewChoice`, lib/standings), por isso sobrevive a sair e voltar; só conta enquanto o seletor se mostra.
import { useReducer, useState } from 'react';
import { View } from 'react-native';
import { MatchScrollView } from '@/components/match/MatchScroll';
import { router } from 'expo-router';
import { BracketView } from '@/components/BracketView';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { SkeletonRows } from '@/components/Skeleton';
import { StandingsTable } from '@/components/StandingsTable';
import { Segmented } from '@/components/Segmented';
import { Tabs } from '@/components/Tabs';
import { Touchable } from '@/components/Touchable';
import { SportSchema, type Sport } from '@/data/schemas';
import { useNow } from '@/data/clock';
import { useCompetition, useCompetitionData } from '@/data/sports';
import { liveStandingsAvailable, projectStandings } from '@/lib/liveStandings';
import {
  getViewChoice,
  hasBracketTies,
  hasTableRows,
  resolveView,
  setViewChoice,
  showSelector,
  type StandingsView,
} from '@/lib/standings';
import { SPORTING_API_ID } from '@/lib/teams';
import { Body, Text71 } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';

export const STANDINGS_ERROR = 'Não foi possível carregar os dados.';
const NO_STANDINGS = 'Sem classificação para esta competição.';
export const LIVE_NOTE = 'Com os resultados dos jogos a decorrer. A tabela oficial da Liga atualiza de hora a hora.';
type Mode = 'live' | 'official';
/** O documento de jogos ao vivo só se reavalia (velho ou não) a cada 30 s. */
const LIVE_CHECK_MS = 30_000;
const SPORTING = String(SPORTING_API_ID);
/** `roller_hockey_…` também tem "_" no nome: compara o prefixo com cada modalidade. Desconhecida: null. */
const sportOfKey = (key: string): Sport | null => SportSchema.options.find((s) => key.startsWith(`${s}_`)) ?? null;
const VIEWS: { key: StandingsView; label: string }[] = [
  { key: 'table', label: 'Tabela' },
  { key: 'bracket', label: 'Eliminatórias' },
];

export function CompetitionStandings({
  competitionKey,
  showCompetitionLink = true,
}: {
  competitionKey: string;
  /** Falso dentro do próprio ecrã da competição (Task 13, preflight F10). */
  showCompetitionLink?: boolean;
}) {
  const competition = useCompetition(competitionKey);
  const standings = useCompetitionData(competitionKey, 'standings');
  const bracket = useCompetitionData(competitionKey, 'bracket');
  const liveDoc = useCompetitionData(competitionKey, 'liveFixtures');
  const now = useNow(LIVE_CHECK_MS);
  const [mode, setMode] = useState<Mode>('live');
  // A escolha vive no módulo (sessão da app); isto só volta a desenhar depois de a gravar.
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const reads = [competition, standings, bracket];
  if (reads.some((r) => r.status === 'loading')) return <View style={{ paddingHorizontal: spacing.lg }}><SkeletonRows testID="standings-loading" /></View>;
  if (reads.some((r) => r.status === 'error')) return <EmptyState icon="info" text={STANDINGS_ERROR} />;

  const view = competition.status === 'ready' ? competition.data.view : undefined;
  // Sem o documento da competição, a modalidade vem da chave `{sport}_{leagueId}_{season}`.
  const sport = competition.status === 'ready' ? competition.data.sport : sportOfKey(competitionKey);
  const table = standings.status === 'ready' ? standings.data : null;
  const knockout = bracket.status === 'ready' ? bracket.data : null;
  const hasRows = hasTableRows(table);
  const hasTies = hasBracketTies(knockout);
  if (!hasRows && !hasTies) return <EmptyState icon="info" text={NO_STANDINGS} />;

  const selector = showSelector(view, hasRows, hasTies);
  // Sem seletor não há como desfazer uma escolha antiga: aí manda o servidor.
  const userChoice = selector ? getViewChoice(competitionKey) : null;
  const shown = resolveView(view, hasRows, hasTies, userChoice);
  const choose = (v: StandingsView) => {
    setViewChoice(competitionKey, v);
    rerender();
  };
  // Leitura do documento ao vivo nunca bloqueia nem falha a página: sem ele, tabela oficial.
  const liveReady = liveDoc.status === 'ready' ? liveDoc.data : null;
  const liveOn = table !== null && liveReady !== null && liveStandingsAvailable(liveReady, now);
  const projected =
    shown === 'table' && table && liveOn && mode === 'live'
      ? table.groups.map((g) => ({ ...g, rows: projectStandings(g.rows, liveReady.fixtures).rows }))
      : null;
  const fromCache = reads.some((r) => r.status === 'ready' && r.fromCache === true);

  return (
    <MatchScrollView
      testID="competition-standings"
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: layout.stContentGap }}
    >
      <OfflineBanner visible={fromCache} />
      {selector ? (
        <Tabs items={VIEWS} value={shown} onChange={choose} mode="equal" />
      ) : null}
      {shown === 'table' && liveOn ? (
        <Segmented
          testID="standings-live-toggle"
          items={[
            {
              key: 'live' as Mode,
              label: 'Ao vivo',
              content: (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.stLegendItemGap }}>
                  <View style={{ width: layout.stLiveDot, height: layout.stLiveDot, borderRadius: layout.stLiveDot / 2, backgroundColor: colors.white }} />
                  <Text71 variant="label16" color={mode === 'live' ? 'white' : 'textMuted'} numberOfLines={1}>Ao vivo</Text71>
                </View>
              ),
            },
            { key: 'official' as Mode, label: 'Oficial' },
          ]}
          value={mode}
          onChange={setMode}
        />
      ) : null}
      {projected ? <Text71 variant="caption12" color="textMuted">{LIVE_NOTE}</Text71> : null}
      {shown === 'table' && table ? <StandingsTable groups={projected ?? table.groups} highlightTeamId={SPORTING} sport={sport} /> : null}
      {shown === 'bracket' && knockout ? <BracketView bracket={knockout} highlightTeamId={SPORTING} /> : null}
      {showCompetitionLink ? (
        <Touchable
          accessibilityRole="link"
          accessibilityLabel="Ver competição"
          onPress={() => router.push(`/competicao/${competitionKey}`)}
          style={{
            minHeight: layout.minTouch,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Body variant="tab" style={{ color: colors.primary }}>Ver competição</Body>
        </Touchable>
      ) : null}
    </MatchScrollView>
  );
}
