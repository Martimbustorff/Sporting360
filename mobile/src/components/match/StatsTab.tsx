// Figma V7.1: 4947:8037 (31 Jogo · Estatísticas): blocos com valores, rótulo e barra (a do valor maior a primary-on-dark) e a linha "Cartões" no fim.
// Alternador Total / 1.ª parte / 2.ª parte (o do frame): só com `firstHalf` (instantâneo do intervalo gravado pelo ticker);
// 2.ª parte = total menos 1.ª nas contagens e sem as linhas de percentagem (posse). Sem `firstHalf` não há alternador.
// Decisão: mantém-se o conjunto e os rótulos já existentes (10 estatísticas, `lib/stats`); o frame mostra "Passes certos"
// em vez de xG e Faltas, mas a regra de negócio já testada ganha. Amarelos e vermelhos juntam-se na linha "Cartões".
// SEM FIGMA: o estado de erro, "Sem estatísticas para este jogo." (terminado,
// adiado ou cancelado sem documento), o aviso de cache e o estado antes do jogo (as mesmas linhas a 30 %).
import { useState } from 'react';
import { SkeletonRows } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Segmented } from '@/components/Segmented';
import { CardsRow, StatRow } from '@/components/StatRow';
import type { Match } from '@/data/schemas';
import { useMatchDetail } from '@/data/sports';
import { uiState } from '@/lib/matchVM';
import { hasHalves, partRows, type StatPart } from '@/lib/stats';
import { layout, spacing } from '@/theme/tokens';
import { MatchScrollView } from '@/components/match/MatchScroll';

export const STATS_ERROR = 'Não foi possível carregar os dados.';
const NO_STATS = 'Sem estatísticas para este jogo.';

const PARTS: { key: StatPart; label: string }[] = [
  { key: 'total', label: 'Total' },
  { key: 'first', label: '1.ª parte' },
  { key: 'second', label: '2.ª parte' },
];

/**
 * "2.ª parte" (total menos 1.ª) só vale com a 2.ª parte a decorrer ou o jogo terminado nos 90': no intervalo seria tudo
 * zero e, com prolongamento (AET, PEN ou estados ET, BT, P), o total da API inclui-o e não seria só a 2.ª parte.
 */
function secondHalfAvailable(match: Match): boolean {
  if (match.status === 'HT' || match.status === 'AET' || match.status === 'PEN') return false;
  const raw = match.statusRaw;
  if (raw === 'ET' || raw === 'BT' || raw === 'P') return false;
  return match.score.extratime == null;
}

export function StatsTab({ match }: { match: Match }) {
  const [part, setPart] = useState<StatPart>('total');
  const stats = useMatchDetail(match.id, 'statistics');
  const state = uiState(match.status);
  if (stats.status === 'loading') return <SkeletonRows padded testID="stats-loading" />;
  if (stats.status === 'error') return <EmptyState icon="info" text={STATS_ERROR} />;

  const doc = stats.status === 'ready' ? stats.data : null;
  const preGame = state === 'scheduled' && !doc;
  if (!doc && !preGame && state !== 'live' && state !== 'halftime') return <EmptyState icon="info" text={NO_STATS} />;

  const halves = !preGame && hasHalves(doc);
  const items = secondHalfAvailable(match) ? PARTS : PARTS.filter((p) => p.key !== 'second');
  // Uma 2.ª parte escolhida que deixou de existir (intervalo, prolongamento) volta ao Total.
  const shown: StatPart = halves && items.some((p) => p.key === part) ? part : 'total';
  const rows = partRows(doc, shown, match.home.id, match.away.id);
  const byKey = (key: string) => rows.find((r) => r.key === key) ?? { label: '', home: '0', away: '0' };
  const bars = rows.filter((r) => r.key !== 'Yellow Cards' && r.key !== 'Red Cards');
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
      {halves ? <Segmented testID="stats-part-selector" items={items} value={shown} onChange={setPart} /> : null}
      {bars.map((r) => (
        <StatRow key={r.key} label={r.label} home={r.home} away={r.away} muted={preGame} />
      ))}
      <CardsRow
        home={{ yellow: yellow.home, red: red.home }}
        away={{ yellow: yellow.away, red: red.away }}
        muted={preGame}
      />
    </MatchScrollView>
  );
}
