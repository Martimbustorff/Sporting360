// Figma V7.1: 4947:8323 (32 Jogo · Formações): alternador de equipa "SPORTING · 3-4-3 / ADVERSÁRIO · 4-3-3", campo com
// uma equipa de cada vez (`Pitch`, jogador 4947:8538), "SUPLENTES" em Eyebrow 13 text-subtle e linhas de suplente
// (número Label 16 text-subtle, nome Body 14, à direita "entrou aos 90+2'" ou "não jogou" em Caption 12 text-muted).
// "entrou aos" vem dos lances de substituição (`events`, o mesmo documento do Sumário: quem entra é `assistId`);
// "não jogou" só com o jogo terminado e o documento `players` com entrada do jogador com 0 minutos; nos outros casos a coluna fica vazia.
// SEM FIGMA: a linha "Treinador", o texto sobre quando saem os onzes, o estado de erro,
// "Sem formações para este jogo." e o aviso de cache.
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { SkeletonRows } from '@/components/Skeleton';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { GoalBall, Pitch } from '@/components/Pitch';
import { InfoRow } from '@/components/SectionBar';
import { Segmented } from '@/components/Segmented';
import { Touchable } from '@/components/Touchable';
import type { EventsDoc, LineupPlayer, LineupsDoc, Match, PlayersDoc } from '@/data/schemas';
import { useMatchDetail } from '@/data/sports';
import { uiState } from '@/lib/matchVM';
import { enteredText, goalsMap, photosMap, pitchRows, ratingNumbers, ratingsMap } from '@/lib/pitch';
import { Text71 } from '@/theme/typography';
import { layout, space, spacing } from '@/theme/tokens';
import { MatchScrollView } from '@/components/match/MatchScroll';

export const LINEUPS_ERROR = 'Não foi possível carregar os dados.';
const LINEUPS_SOON = 'Os onzes são conhecidos cerca de uma hora antes do jogo.';
const NO_LINEUPS = 'Sem formações para este jogo.';
const DID_NOT_PLAY = 'não jogou';

type TeamLineup = LineupsDoc['teams'][number];
type Side = 'home' | 'away';

/** Minuto de entrada por `playerId` (substituições: `assistId` entra, `playerId` sai). */
function entryTexts(events: EventsDoc | null, teamId: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const e of events?.items ?? []) {
    if (e.type === 'subst' && e.teamId === teamId && e.assistId && !(e.assistId in out)) {
      out[e.assistId] = enteredText(e.minute, e.extra);
    }
  }
  return out;
}

/** Minutos do jogador no documento `players`; null se não há documento ou entrada para ele. */
function playedMinutes(players: PlayersDoc | null, playerId: string): number | null {
  for (const t of players?.teams ?? []) {
    const line = t.players.find((p) => p.playerId === playerId);
    if (line) return line.minutes ?? 0;
  }
  return null;
}

function SubRow({ p, note, onPress, goals = 0 }: { p: LineupPlayer; note: string | null; onPress?: () => void; goals?: number }) {
  const content = (
    <>
      <Text71 variant="label16" color="textSubtle" style={{ minWidth: layout.subNumberWidth }}>
        {p.number != null ? String(p.number) : ''}
      </Text71>
      <View style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: space.s8 }}>
        <Text71 variant="body14" numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 1, minWidth: 0 }}>{p.name}</Text71>
        <GoalBall goals={goals} testID="sub-goals" />
      </View>
      {note ? <Text71 variant="caption12" color="textMuted" numberOfLines={1} testID="sub-note">{note}</Text71> : null}
    </>
  );
  const style = {
    minHeight: layout.minTouch,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: layout.subRowGap,
  };
  const label = `Suplente ${p.name}${goals === 1 ? ', 1 golo' : goals > 1 ? `, ${goals} golos` : ''}`;
  return onPress ? (
    <Touchable testID="sub-row" accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={style}>
      {content}
    </Touchable>
  ) : (
    <View testID="sub-row" accessible accessibilityLabel={label} style={style}>
      {content}
    </View>
  );
}

export function LineupsTab({ match }: { match: Match }) {
  const lineups = useMatchDetail(match.id, 'lineups');
  const players = useMatchDetail(match.id, 'players');
  const events = useMatchDetail(match.id, 'events');
  const [selected, setSelected] = useState<'sporting' | 'opponent'>('sporting');
  const state = uiState(match.status);
  if (lineups.status === 'loading') return <SkeletonRows padded testID="lineups-loading" />;
  if (lineups.status === 'error') return <EmptyState icon="info" text={LINEUPS_ERROR} />;

  const doc = lineups.status === 'ready' ? lineups.data : null;
  const find = (id: string) => doc?.teams.find((t) => t.teamId === id) ?? null;
  const none = !find(match.home.id) && !find(match.away.id);
  const beforeOrDuring = state === 'scheduled' || state === 'live' || state === 'halftime';
  if (none && !beforeOrDuring) return <EmptyState icon="info" text={NO_LINEUPS} />;

  // Uma leitura falhada das notas, das fotos ou dos lances não esconde os onzes: só ficam sem nota, foto ou entrada.
  const playersDoc = players.status === 'ready' ? players.data : null;
  const eventsDoc = events.status === 'ready' ? events.data : null;
  const ratings = ratingsMap(playersDoc);
  const ratingValues = ratingNumbers(playersDoc);
  const goals = goalsMap(eventsDoc);
  const photos = photosMap(playersDoc);
  const openPlayer = (id: string) => router.push(`/equipa/jogador/${id}`);

  const sportingSide: Side = match.sportingSide;
  const opponentSide: Side = sportingSide === 'home' ? 'away' : 'home';
  const sides = {
    sporting: { info: match[sportingSide], team: find(match[sportingSide].id) as TeamLineup | null },
    opponent: { info: match[opponentSide], team: find(match[opponentSide].id) as TeamLineup | null },
  };
  const current = sides[selected];
  const team = current.team;
  const toggleLabel = (k: 'sporting' | 'opponent') => {
    const s = sides[k];
    return [s.info.name, s.team?.formation].filter(Boolean).join(' · ');
  };
  const toggleItem = (k: 'sporting' | 'opponent') => ({
    key: k,
    label: toggleLabel(k),
    // O nome encurta com reticências; a tática nunca.
    content: (
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', minWidth: 0, maxWidth: '100%' }}>
        <Text71 variant="label16" color={selected === k ? 'white' : 'textMuted'} numberOfLines={1} style={{ flexShrink: 1 }}>
          {sides[k].info.name}
        </Text71>
        {sides[k].team?.formation ? (
          <Text71 variant="label16" color={selected === k ? 'white' : 'textMuted'} numberOfLines={1} style={{ flexShrink: 0 }}>
            {` · ${sides[k].team?.formation}`}
          </Text71>
        ) : null}
      </View>
    ),
  });
  const entries = entryTexts(eventsDoc, current.info.id);
  const finished = state === 'finished';
  const subNote = (p: LineupPlayer): string | null => {
    const entered = entries[p.playerId];
    if (entered) return entered;
    if (finished && playedMinutes(playersDoc, p.playerId) === 0) return DID_NOT_PLAY; // sem documento ou entrada: sem nota
    return null;
  };

  return (
    <MatchScrollView
      testID="lineups-tab"
      contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: layout.lineupBlockGap }}
    >
      <OfflineBanner visible={lineups.status === 'ready' && lineups.fromCache === true} />
      {none ? (
        <Text71 variant="body14" color="textMuted" style={{ textAlign: 'center' }}>{LINEUPS_SOON}</Text71>
      ) : (
        <Segmented
          testID="team-selector"
          items={[toggleItem('sporting'), toggleItem('opponent')]}
          value={selected}
          onChange={setSelected}
        />
      )}
      <Pitch
        rows={team ? pitchRows(team.startXI) : []}
        ratings={ratings}
        ratingValues={ratingValues}
        photos={photos}
        goals={goals}
        missing={!none && !team}
        onPlayer={selected === 'sporting' ? openPlayer : undefined}
      />
      {team && team.substitutes.length > 0 ? (
        <View testID="subs">
          <Text71 variant="eyebrow13" color="textSubtle">Suplentes</Text71>
          {team.substitutes.map((p, i) => (
            <SubRow
              key={`${p.playerId}-${i}`}
              p={p}
              note={subNote(p)}
              goals={goals[p.playerId] ?? 0}
              onPress={selected === 'sporting' ? () => openPlayer(p.playerId) : undefined}
            />
          ))}
        </View>
      ) : null}
      {team?.coach ? <InfoRow label="Treinador" value={team.coach.name} /> : null}
    </MatchScrollView>
  );
}
