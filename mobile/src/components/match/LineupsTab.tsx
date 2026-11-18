// Figma: nós 498:28089 (ao vivo: campo 498:28129 com os dois onzes, jogador 498:28140, em `Pitch`) e 500:29521
// (jogo futuro: o mesmo campo vazio).
// SEM FIGMA: a barra de cada equipa com a tática ("4-3-3") e a linha "Treinador" (SectionBar e InfoRow do 655:31905 /
// 655:31960), a lista de suplentes (número, nome, nota), o texto sobre quando saem os onzes, o esqueleto em branco,
// o estado de erro, "Sem formações para este jogo." e o aviso de cache.
import { router } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Pitch } from '@/components/Pitch';
import { InfoRow, SectionBar } from '@/components/SectionBar';
import type { LineupPlayer, LineupsDoc, Match } from '@/data/schemas';
import { useMatchDetail } from '@/data/sports';
import { uiState } from '@/lib/matchVM';
import { pitchRows, ratingsMap } from '@/lib/pitch';
import { Body, Display } from '@/theme/typography';
import { layout, spacing } from '@/theme/tokens';

export const LINEUPS_ERROR = 'Não foi possível carregar os dados.';
const LINEUPS_SOON = 'Os onzes são conhecidos cerca de uma hora antes do jogo.';
const NO_LINEUPS = 'Sem formações para este jogo.';

type TeamLineup = LineupsDoc['teams'][number];

function TeamBar({ name, team }: { name: string; team: TeamLineup | null }) {
  return (
    <View style={{ gap: spacing.xs }}>
      <SectionBar label={name} right={team?.formation ?? undefined} />
      {team?.coach ? <InfoRow label="Treinador" value={team.coach.name} /> : null}
    </View>
  );
}

function SubRow({ p, rating, onPress }: { p: LineupPlayer; rating?: string; onPress?: () => void }) {
  const content = (
    <>
      <Display variant="minute" style={{ width: layout.subNumberWidth }}>{p.number != null ? String(p.number) : ''}</Display>
      <Body variant="body" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1 }}>{p.name}</Body>
      {rating ? <Body variant="badge">{rating}</Body> : null}
    </>
  );
  const style = {
    minHeight: layout.minTouch,
    paddingHorizontal: spacing.md,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing.sm,
  };
  const label = `Suplente ${p.name}`;
  return onPress ? (
    <Pressable testID="sub-row" accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {content}
    </Pressable>
  ) : (
    <View testID="sub-row" accessible accessibilityLabel={label} style={style}>
      {content}
    </View>
  );
}

export function LineupsTab({ match }: { match: Match }) {
  const lineups = useMatchDetail(match.id, 'lineups');
  const players = useMatchDetail(match.id, 'players');
  const state = uiState(match.status);
  if (lineups.status === 'loading') return <View testID="lineups-loading" />;
  if (lineups.status === 'error') return <EmptyState icon="info" text={LINEUPS_ERROR} />;

  const doc = lineups.status === 'ready' ? lineups.data : null;
  const find = (id: string) => doc?.teams.find((t) => t.teamId === id) ?? null;
  const home = find(match.home.id);
  const away = find(match.away.id);
  const none = !home && !away;
  const beforeOrDuring = state === 'scheduled' || state === 'live' || state === 'halftime';
  if (none && !beforeOrDuring) return <EmptyState icon="info" text={NO_LINEUPS} />;

  // Uma leitura falhada das notas não esconde os onzes: só ficam sem nota.
  const ratings = ratingsMap(players.status === 'ready' ? players.data : null);
  const openPlayer = (id: string) => router.push(`/equipa/jogador/${id}`);
  const sides = [
    { side: 'home' as const, info: match.home, team: home },
    { side: 'away' as const, info: match.away, team: away },
  ];

  return (
    <ScrollView
      testID="lineups-tab"
      contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      <OfflineBanner visible={lineups.status === 'ready' && lineups.fromCache === true} />
      {none ? (
        <Body variant="body" style={{ textAlign: 'center', opacity: layout.mutedOpacity }}>{LINEUPS_SOON}</Body>
      ) : (
        <TeamBar name={match.home.name} team={home} />
      )}
      <Pitch
        home={home ? pitchRows(home.startXI) : []}
        away={away ? pitchRows(away.startXI) : []}
        ratings={ratings}
        sportingSide={match.sportingSide}
        onPlayer={openPlayer}
      />
      {none ? null : <TeamBar name={match.away.name} team={away} />}
      {sides.some((s) => (s.team?.substitutes.length ?? 0) > 0) ? <SectionBar label="Suplentes" /> : null}
      {sides.map(({ side, info, team }) =>
        team && team.substitutes.length > 0 ? (
          <View key={side}>
            <Body variant="tab" numberOfLines={1} style={{ paddingHorizontal: spacing.md, opacity: layout.mutedOpacity }}>
              {info.name}
            </Body>
            {team.substitutes.map((p, i) => (
              <SubRow
                key={`${p.playerId}-${i}`}
                p={p}
                rating={ratings[p.playerId]}
                onPress={side === match.sportingSide ? () => openPlayer(p.playerId) : undefined}
              />
            ))}
          </View>
        ) : null,
      )}
    </ScrollView>
  );
}
