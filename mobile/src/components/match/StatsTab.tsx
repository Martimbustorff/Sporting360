// Figma: nós 498:28453 (ao vivo, linhas 500:28650) e 500:29236 (jogo futuro: as mesmas 10 linhas a zero, valores
// a 30 %). Linhas em `StatRow`; divisória de 1 px a 20 % entre linhas (500:28667).
// SEM FIGMA: o esqueleto em branco enquanto carrega, o estado de erro, "Sem estatísticas para este jogo." (terminado,
// adiado ou cancelado sem documento) e o aviso de cache.
import { ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { StatRow } from '@/components/StatRow';
import type { Match } from '@/data/schemas';
import { useMatchDetail } from '@/data/sports';
import { uiState } from '@/lib/matchVM';
import { STAT_ORDER, statRows } from '@/lib/stats';
import { colors, layout, spacing } from '@/theme/tokens';

export const STATS_ERROR = 'Não foi possível carregar os dados.';
const NO_STATS = 'Sem estatísticas para este jogo.';
const CARD: Record<string, 'yellow' | 'red'> = { 'Yellow Cards': 'yellow', 'Red Cards': 'red' };

export function StatsTab({ match }: { match: Match }) {
  const stats = useMatchDetail(match.id, 'statistics');
  const state = uiState(match.status);
  if (stats.status === 'loading') return <View testID="stats-loading" />;
  if (stats.status === 'error') return <EmptyState icon="info" text={STATS_ERROR} />;

  const doc = stats.status === 'ready' ? stats.data : null;
  const preGame = state === 'scheduled' && !doc;
  if (!doc && !preGame && state !== 'live' && state !== 'halftime') return <EmptyState icon="info" text={NO_STATS} />;

  const rows = statRows(doc, match.home.id, match.away.id);
  const rowKey = (i: number) => STAT_ORDER[i]?.key ?? String(i);
  return (
    <ScrollView
      testID="stats-tab"
      contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingBottom: spacing.xl }}
    >
      <OfflineBanner visible={stats.status === 'ready' && stats.fromCache === true} />
      {rows.map((r, i) => (
        <View key={rowKey(i)}>
          {i > 0 ? (
            <View style={{ height: layout.separator, backgroundColor: colors.surface20, marginVertical: layout.statRowGap }} />
          ) : null}
          <StatRow {...r} card={CARD[rowKey(i)]} muted={preGame} />
        </View>
      ))}
    </ScrollView>
  );
}
