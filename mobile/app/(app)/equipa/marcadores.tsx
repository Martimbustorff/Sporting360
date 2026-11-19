// Figma V7.1: frame 11 "Equipa · Marcadores e assistências" (4935:7423). Header "Marcadores"; chips de competição
// (Todas / Liga / Champions / Taças, pílulas; branco ativo, surface-10 inativo), alternador Golos / Assistências / G+A,
// cartão do líder (gradiente primary para primaryDeep, foto 56, "Melhor marcador", nome, "PL · jogos · 1 golo a cada X min")
// e linhas 2.º em diante (posição, foto 36, nome, posição · outra métrica, barra proporcional ao líder, valor Title S 20).
// Dados: `playerStats_{época}` (`byLeague` por liga). Sem `byLeague` (documento antigo) só há "Todas".
// Diferenças ao frame: a API só dá a posição em 4 grupos (GR, DEF, MED, AV), não PL/EXT/DD; sem barra de estado nem home indicator.
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PlayerPhoto } from '@/components/PlayerPhoto';
import { Loading } from '@/components/TeamRows';
import { Screen } from '@/components/Screen';
import { Touchable } from '@/components/Touchable';
import { useNow } from '@/data/clock';
import { usePlayerStats, useTeamData } from '@/data/sports';
import { footballSeason } from '@/lib/periods';
import { availableFilters, squadLeaders, type LeaderFilter, type LeaderMetric, type LeaderRow } from '@/lib/squadLeaders';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

const ERROR_TEXT = 'Não foi possível carregar os dados.';
const NO_DATA = 'Sem estatísticas de jogadores nesta época.';
const FOOTNOTE = 'Dados da API-Football, atualizados uma vez por dia.';

const FILTER_LABEL: Record<LeaderFilter, string> = { all: 'Todas', league: 'Liga', champions: 'Champions', cups: 'Taças' };
const METRICS: { key: LeaderMetric; label: string }[] = [
  { key: 'goals', label: 'Golos' },
  { key: 'assists', label: 'Assistências' },
  { key: 'ga', label: 'G+A' },
];
const EYEBROW: Record<LeaderMetric, string> = { goals: 'Melhor marcador', assists: 'Melhor assistente', ga: 'Melhor em golos e assistências' };
const UNIT: Record<LeaderMetric, string> = { goals: 'Golos', assists: 'Assistências', ga: 'G+A' };
const POSITION_ABBR: Record<string, string> = { Goalkeeper: 'GR', Defender: 'DEF', Midfielder: 'MED', Attacker: 'AV' };

/** Sem líder: competição ativa sem registos, ou a época ainda sem golos / assistências. */
const emptyText = (f: LeaderFilter, m: LeaderMetric) =>
  f !== 'all' ? 'Sem registos nesta competição.' : m === 'assists' ? 'Ainda sem assistências esta época.' : 'Ainda sem golos esta época.';
const goalsText = (n: number) => `${n} ${n === 1 ? 'golo' : 'golos'}`;
const gamesText = (n: number) => `${n} ${n === 1 ? 'jogo' : 'jogos'}`;

/** Segunda linha da linha de jogador: a outra métrica (golos mostram assistências e vice-versa). */
function secondary(r: LeaderRow, metric: LeaderMetric): string {
  if (metric === 'goals') return `${r.assists} assist.`;
  if (metric === 'assists') return goalsText(r.goals);
  return `${goalsText(r.goals)} · ${r.assists} assist.`;
}

function Chips({ filters, value, onChange }: { filters: LeaderFilter[]; value: LeaderFilter; onChange: (f: LeaderFilter) => void }) {
  return (
    <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s8 }}>
      {filters.map((f) => {
        const active = f === value;
        return (
          <Touchable
            key={f}
            testID={`chip-${f}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={FILTER_LABEL[f]}
            onPress={() => onChange(f)}
            style={{
              paddingHorizontal: layout.leaderChipPadX,
              paddingVertical: layout.leaderChipPadY,
              borderRadius: layout.leaderChipRadius,
              backgroundColor: active ? colors.white : colors.surface10,
            }}
          >
            <Text71 variant="label16" color={active ? 'ink' : 'white'} numberOfLines={1}>{FILTER_LABEL[f]}</Text71>
          </Touchable>
        );
      })}
    </View>
  );
}

function Switcher({ value, onChange }: { value: LeaderMetric; onChange: (m: LeaderMetric) => void }) {
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', gap: layout.segmentedGap, padding: layout.segmentedPad, borderRadius: layout.segmentedRadius, backgroundColor: colors.surface06 }}
    >
      {METRICS.map((m) => {
        const active = m.key === value;
        return (
          <Touchable
            key={m.key}
            testID={`metric-${m.key}`}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={m.label}
            onPress={() => onChange(m.key)}
            style={{
              flex: 1,
              minWidth: 0,
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: layout.segmentedItemPadY,
              borderRadius: radii.r8,
              backgroundColor: active ? colors.primary : undefined,
            }}
          >
            <Text71 variant="label16" color={active ? 'white' : 'textMuted'} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{m.label}</Text71>
          </Touchable>
        );
      })}
    </View>
  );
}

const openPlayer = (id: string) => router.push(`/equipa/jogador/${id}`);

function LeaderCard({ r, metric, position }: { r: LeaderRow; metric: LeaderMetric; position?: string | null }) {
  const parts = [gamesText(r.appearances)];
  const abbr = POSITION_ABBR[position ?? ''];
  if (abbr) parts.unshift(abbr);
  if (metric === 'goals' && r.minutesPerGoal !== null) parts.push(`1 golo a cada ${r.minutesPerGoal} min`);
  return (
    <Touchable
      testID="leader-card"
      accessibilityRole="button"
      accessibilityLabel={`${EYEBROW[metric]}: ${r.player.name}, ${r.value} ${UNIT[metric]}, ${parts.join(', ')}`}
      onPress={() => openPlayer(r.player.id)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s16,
        paddingHorizontal: layout.leaderCardPadX,
        paddingVertical: layout.leaderCardPadY,
        borderRadius: radii.r16,
        overflow: 'hidden',
      }}
    >
      <Svg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" preserveAspectRatio="none" accessible={false}>
        <Defs>
          <LinearGradient id="leaderGrad" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={colors.primary} />
            <Stop offset="1" stopColor={colors.primaryDeep} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#leaderGrad)" />
      </Svg>
      <PlayerPhoto photo={r.player.photo} size={layout.leaderPhoto} testID="leader-photo" />
      <View style={{ flex: 1, minWidth: 0, gap: layout.leaderTextGap }}>
        <Text71 variant="eyebrow13" numberOfLines={1} ellipsizeMode="tail">{EYEBROW[metric]}</Text71>
        <Text71 variant="titleS20" numberOfLines={1} ellipsizeMode="tail">{r.player.name}</Text71>
        <Text71 variant="caption12" numberOfLines={1} ellipsizeMode="tail">{parts.join(' · ')}</Text71>
      </View>
      <View style={{ alignItems: 'center', flexShrink: 0 }}>
        <Text71 variant="display40">{r.value}</Text71>
        <Text71 variant="badge11">{UNIT[metric]}</Text71>
      </View>
    </Touchable>
  );
}

function PlayerRow({ r, rank, top, metric, position }: { r: LeaderRow; rank: number; top: number; metric: LeaderMetric; position?: string | null }) {
  const ratio = top > 0 ? Math.min(1, r.value / top) : 0;
  const pos = POSITION_ABBR[position ?? ''];
  const sub = pos ? `${pos} · ${secondary(r, metric)}` : secondary(r, metric);
  return (
    <Touchable
      testID={`leader-row-${r.player.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${rank}.º ${r.player.name}, ${r.value} ${UNIT[metric]}, ${sub}`}
      onPress={() => openPlayer(r.player.id)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s12,
        paddingVertical: layout.leaderRowPadY,
        borderBottomWidth: layout.separator,
        borderBottomColor: colors.separator,
      }}
    >
      <Text71 variant="label16" color="textSubtle" style={{ width: layout.leaderRankWidth }}>{rank}</Text71>
      <PlayerPhoto photo={r.player.photo} size={layout.leaderRowPhoto} />
      <View style={{ flex: 1, minWidth: 0, gap: layout.leaderNameGap }}>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: layout.leaderNameGap }}>
          <Text71 variant="strong14" numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 1 }}>{r.player.name}</Text71>
          <Text71 variant="caption12" color="textSubtle" numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 0 }}>{sub}</Text71>
        </View>
        <View style={{ height: layout.leaderBarHeight, borderRadius: layout.leaderBarRadius, backgroundColor: colors.surface10, overflow: 'hidden' }}>
          <View testID={`leader-bar-${r.player.id}`} style={{ width: `${ratio * 100}%`, height: layout.leaderBarHeight, borderRadius: layout.leaderBarRadius, backgroundColor: colors.primaryOnDark }} />
        </View>
      </View>
      <Text71 variant="titleS20" style={{ flexShrink: 0 }}>{r.value}</Text71>
    </Touchable>
  );
}

export default function Marcadores() {
  const now = useNow();
  const season = useMemo(() => footballSeason(now), [now]);
  const stats = usePlayerStats(season);
  // A posição vem do plantel (secundário: sem ele as linhas só perdem a abreviatura).
  const squad = useTeamData('squad');
  const positions = useMemo(() => new Map((squad.status === 'ready' ? squad.data.players : []).map((q) => [q.id, q.position])), [squad]);
  const [filter, setFilter] = useState<LeaderFilter>('all');
  const [metric, setMetric] = useState<LeaderMetric>('goals');
  const players = stats.status === 'ready' ? stats.data.players : null;
  const filters = useMemo(() => (players ? availableFilters(players) : (['all'] as LeaderFilter[])), [players]);
  const active = filters.includes(filter) ? filter : 'all';
  const { leader, rest } = useMemo(() => (players ? squadLeaders(players, active, metric) : { leader: null, rest: [] }), [players, active, metric]);

  let body;
  if (stats.status === 'loading') body = <Loading testID="leaders-loading" />;
  else if (stats.status === 'error') body = <EmptyState icon="info" text={ERROR_TEXT} />;
  else if (!players || players.length === 0) body = <EmptyState icon="info" text={NO_DATA} />;
  else
    body = (
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.s24, paddingBottom: space.s24, gap: space.s16 }}>
        <OfflineBanner visible={stats.status === 'ready' && stats.fromCache === true} />
        {filters.length > 1 ? <Chips filters={filters} value={active} onChange={setFilter} /> : null}
        <Switcher value={metric} onChange={setMetric} />
        {leader ? (
          <>
            <LeaderCard r={leader} metric={metric} position={positions.get(leader.player.id)} />
            <View>
              {rest.map((r, i) => (
                <PlayerRow key={r.player.id} r={r} rank={i + 2} top={leader.value} metric={metric} position={positions.get(r.player.id)} />
              ))}
            </View>
          </>
        ) : (
          <EmptyState icon="info" text={emptyText(active, metric)} />
        )}
        <Text71 variant="caption12" color="textSubtle">{FOOTNOTE}</Text71>
      </ScrollView>
    );

  return (
    <Screen padded="none">
      <Header title="Marcadores" onBack={() => router.back()} />
      {body}
    </Screen>
  );
}
