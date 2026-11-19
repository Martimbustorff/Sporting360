// Figma V7.1: 4947:8037 (31 Jogo · Estatísticas): blocos com valores, rótulo e barra (a do valor maior a primary-on-dark) e a linha "Cartões" no fim.
// O alternador Jogo / 1.ª parte / 2.ª parte do frame fica pendente de o servidor gravar as partes (decisão futura).
// Decisão: mantém-se o conjunto e os rótulos já existentes (10 estatísticas, `lib/stats`); o frame mostra "Passes certos"
// em vez de xG e Faltas, mas a regra de negócio já testada ganha. Amarelos e vermelhos juntam-se na linha "Cartões".
// SEM FIGMA: o estado de erro, "Sem estatísticas para este jogo." (terminado,
// adiado ou cancelado sem documento), o aviso de cache e o estado antes do jogo (as mesmas linhas a 30 %).
import { View } from 'react-native';
import { SkeletonRows } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { CardsRow, StatRow } from '@/components/StatRow';
import type { Match } from '@/data/schemas';
import { useMatchDetail } from '@/data/sports';
import { uiState } from '@/lib/matchVM';
import { STAT_ORDER, statRows } from '@/lib/stats';
import { layout, spacing } from '@/theme/tokens';
import { MatchScrollView } from '@/components/match/MatchScroll';

export const STATS_ERROR = 'Não foi possível carregar os dados.';
const NO_STATS = 'Sem estatísticas para este jogo.';

export function StatsTab({ match }: { match: Match }) {
  const stats = useMatchDetail(match.id, 'statistics');
  const state = uiState(match.status);
  if (stats.status === 'loading') return <SkeletonRows padded testID="stats-loading" />;
  if (stats.status === 'error') return <EmptyState icon="info" text={STATS_ERROR} />;

  const doc = stats.status === 'ready' ? stats.data : null;
  const preGame = state === 'scheduled' && !doc;
  if (!doc && !preGame && state !== 'live' && state !== 'halftime') return <EmptyState icon="info" text={NO_STATS} />;

  const rows = statRows(doc, match.home.id, match.away.id);
  const byKey = (key: string) => {
    const i = STAT_ORDER.findIndex((s) => s.key === key);
    return rows[i] ?? { label: '', home: '0', away: '0' };
  };
  const bars = rows.filter((_, i) => STAT_ORDER[i]?.key !== 'Yellow Cards' && STAT_ORDER[i]?.key !== 'Red Cards');
  const yellow = byKey('Yellow Cards');
  const red = byKey('Red Cards');
  return (
    <MatchScrollView
      testID="stats-tab"
      contentContainerStyle={{
        paddingHorizontal: spacing.lg,
        paddingBottom: spacing.xl,
        gap: layout.statBlockGap,
      }}
    >
      <OfflineBanner visible={stats.status === 'ready' && stats.fromCache === true} />
      {bars.map((r) => (
        <StatRow key={r.label} {...r} muted={preGame} />
      ))}
      <CardsRow
        home={{ yellow: yellow.home, red: red.home }}
        away={{ yellow: yellow.away, red: red.away }}
        muted={preGame}
      />
    </MatchScrollView>
  );
}
