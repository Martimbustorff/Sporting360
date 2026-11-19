// Figma: nós 500:29367 e 489:7432 (tabela, em `StandingsTable`); seletor com `Tabs` (500:28814, modo 'equal').
// SEM FIGMA: o seletor "Tabela"/"Eliminatórias" (só quando há as duas vistas), o quadro (`BracketView`), o esqueleto
// em branco enquanto carrega, o erro, "Sem classificação para esta competição.", o aviso de cache e a ligação
// "Ver competição" (Body tab a primary, centrada, alvo de toque de 44 px).
// A vista abre pela escolha do utilizador, depois por `competitions/{key}.view.primary` (que muda em direto de
// `table` para `bracket` a meio da época, Review Focus 5). A escolha guarda-se por competição até a app reiniciar
// (`setViewChoice`, lib/standings), por isso sobrevive a sair e voltar; só conta enquanto o seletor se mostra.
import { useReducer } from 'react';
import { ScrollView, View } from 'react-native';
import { Touchable } from './Touchable';
import { router } from 'expo-router';
import { BracketView } from '@/components/BracketView';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { StandingsTable } from '@/components/StandingsTable';
import { Tabs } from '@/components/Tabs';
import { SportSchema, type Sport } from '@/data/schemas';
import { useCompetition, useCompetitionData } from '@/data/sports';
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
import { Body } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';

export const STANDINGS_ERROR = 'Não foi possível carregar os dados.';
const NO_STANDINGS = 'Sem classificação para esta competição.';
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
  // A escolha vive no módulo (sessão da app); isto só volta a desenhar depois de a gravar.
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  const reads = [competition, standings, bracket];
  if (reads.some((r) => r.status === 'loading')) return <View testID="standings-loading" />;
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
  const fromCache = reads.some((r) => r.status === 'ready' && r.fromCache === true);

  return (
    <ScrollView
      testID="competition-standings"
      contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      <OfflineBanner visible={fromCache} />
      {selector ? (
        <Tabs items={VIEWS} value={shown} onChange={choose} mode="equal" />
      ) : null}
      {shown === 'table' && table ? <StandingsTable groups={table.groups} highlightTeamId={SPORTING} sport={sport} /> : null}
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
    </ScrollView>
  );
}
