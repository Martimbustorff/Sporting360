// Figma: nós 500:29367 e 489:7432 (tabela, em `StandingsTable`); seletor com `Tabs` (500:28814, modo 'equal').
// SEM FIGMA: o seletor "Tabela"/"Eliminatórias" (só quando há as duas vistas), o quadro (`BracketView`), o esqueleto
// em branco enquanto carrega, o erro, "Sem classificação para esta competição.", o aviso de cache e a ligação
// "Ver competição" (Body tab a primary, centrada, alvo de toque de 44 px).
// A vista abre pela escolha do utilizador nesta sessão, depois por `competitions/{key}.view.primary` (que muda em
// direto de `table` para `bracket` a meio da época, Review Focus 5); a escolha fica em estado local e repõe-se ao
// mudar de competição.
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { BracketView } from '@/components/BracketView';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { StandingsTable } from '@/components/StandingsTable';
import { Tabs } from '@/components/Tabs';
import { useCompetition, useCompetitionData } from '@/data/sports';
import { hasBracketTies, hasTableRows, resolveView, showSelector, type StandingsView } from '@/lib/standings';
import { SPORTING_API_ID } from '@/lib/teams';
import { Body } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';

export const STANDINGS_ERROR = 'Não foi possível carregar os dados.';
const NO_STANDINGS = 'Sem classificação para esta competição.';
const SPORTING = String(SPORTING_API_ID);
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
  const [choice, setChoice] = useState<{ key: string; view: StandingsView } | null>(null);

  const reads = [competition, standings, bracket];
  if (reads.some((r) => r.status === 'loading')) return <View testID="standings-loading" />;
  if (reads.some((r) => r.status === 'error')) return <EmptyState icon="info" text={STANDINGS_ERROR} />;

  const view = competition.status === 'ready' ? competition.data.view : undefined;
  const table = standings.status === 'ready' ? standings.data : null;
  const knockout = bracket.status === 'ready' ? bracket.data : null;
  const hasRows = hasTableRows(table);
  const hasTies = hasBracketTies(knockout);
  if (!hasRows && !hasTies) return <EmptyState icon="info" text={NO_STANDINGS} />;

  const userChoice = choice?.key === competitionKey ? choice.view : null;
  const shown = resolveView(view, hasRows, hasTies, userChoice);
  const fromCache = reads.some((r) => r.status === 'ready' && r.fromCache === true);

  return (
    <ScrollView
      testID="competition-standings"
      contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      <OfflineBanner visible={fromCache} />
      {showSelector(view, hasRows, hasTies) ? (
        <Tabs items={VIEWS} value={shown} onChange={(v) => setChoice({ key: competitionKey, view: v })} mode="equal" />
      ) : null}
      {shown === 'table' && table ? <StandingsTable groups={table.groups} highlightTeamId={SPORTING} /> : null}
      {shown === 'bracket' && knockout ? <BracketView bracket={knockout} highlightTeamId={SPORTING} /> : null}
      {showCompetitionLink ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Ver competição"
          onPress={() => router.push(`/competicao/${competitionKey}`)}
          style={({ pressed }) => ({
            minHeight: layout.minTouch,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? layout.pressedOpacity : 1,
          })}
        >
          <Body variant="tab" style={{ color: colors.primary }}>Ver competição</Body>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}
