// Figma V7.1: 4933:7057 (08 Sumário terminado: cronologia em duas colunas, "Forma · últimos 5", "Confrontos diretos ·
// últimos 5" em barra V/E/D e "Ausências" com o selo "Dúvida") e 4924:6268 (06, ao vivo, em `LiveSummary`). Anteriores:
// 655:31958 ("Informação do Jogo"), 500:28950 (jogo futuro sem dados: EmptyState do Plano 3).
// Decisões: 20/11 (Martim) a cronologia vai do apito inicial ao fim (1.ª parte no topo, como no frame 08 revisto),
// com os separadores por parte e o resultado de cada parte calculado em `groupEvents`; cada bloco só aparece se houver dados (nunca marcadores de posição); numa barra de
// confrontos o segmento sem jogos não aparece; as ausências ficam agrupadas por equipa (Sporting primeiro).
// Plano 10 (20/11): a Previsão da API-Football saiu; no seu lugar a previsão dos sportinguistas (FansPrediction, 52a/b/c).
// SEM FIGMA: o aviso "Pré-jogo ainda não disponível.", as mensagens de adiado, cancelado e sem lances
// (EmptyState `info`), as linhas Capacidade e a fotografia do estádio. A barra "TV/Transmissão Online" (655:31954) fica de
// fora: `matches` não tem canal de TV. O texto `advice` da API (inglês) nunca se mostra.
import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { EventRow } from '@/components/EventRow';
import { TeamCrest, type TeamVM } from '@/components/GameHeader';
import { SPORTING_API_ID } from '@/lib/teams';
import { InfoRow, SectionBar } from '@/components/SectionBar';
import type { InjuriesDoc, Match } from '@/data/schemas';
import { useMatchDetail, useVenue } from '@/data/sports';
import { groupEvents, playedParts, uiState } from '@/lib/matchVM';
import {
  absenceReasonText,
  capacityText,
  formLetters,
  h2hTally,
  isDoubtful,
  isPrematchEmpty,
  type PrematchFull,
} from '@/lib/prematch';
import { Text71 } from '@/theme/typography';
import { colors, formLetterBg, layout, radius, space } from '@/theme/tokens';
import { LiveEvents, LiveNumbers } from '@/components/match/LiveSummary';
import { MatchScrollView } from '@/components/match/MatchScroll';
import { PredictionCard } from '@/components/match/PredictionCard';
import { FansPrediction } from '@/components/match/FansPrediction';
import { MyStory } from '@/components/match/MyStory';

const EMPTY_PREMATCH = 'Disponível no dia de jogo';
const PREMATCH_PENDING = 'Pré-jogo ainda não disponível.';
const POSTPONED = 'Jogo adiado. A nova data aparece aqui quando for conhecida.';
const CANCELLED = 'Jogo cancelado.';
const NO_EVENTS_DONE = 'Sem lances registados.';
const NO_EVENTS_PART = 'Sem incidências.';
const LOAD_ERROR = 'Não foi possível carregar os dados.';


/** Lados do jogo pela ordem do Figma (Sporting primeiro), com o nome e o emblema de cada um. */
function sidesOf(match: Match) {
  const s = match.sportingSide;
  const o = s === 'home' ? 'away' : 'home';
  const crest = (side: 'home' | 'away') => ({
    id: match.sport === 'football' ? Number(match[side].id) : side === s ? SPORTING_API_ID : null,
    name: match[side].name,
    crestUrl: match[side].logo,
  });
  return [
    { side: s, team: match[s], crest: crest(s) },
    { side: o, team: match[o], crest: crest(o) },
  ] as const;
}

function FormRow({ team, crest, form, side }: { team: Match['home']; crest: TeamVM; form: string | null; side: 'home' | 'away' }) {
  const letters = formLetters(form);
  if (letters.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.formRowGap }}>
      <TeamCrest team={crest} size="form" />
      <Text71 variant="body14" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{team.name}</Text71>
      <View
        testID={`form-${side}`}
        accessible
        accessibilityLabel={`Forma: ${letters.join(' ')}`}
        style={{ flexDirection: 'row', gap: layout.formRowGap }}
      >
        {letters.map((l, i) => (
          <View
            key={i}
            style={{
              width: layout.formChip,
              height: layout.formChip,
              borderRadius: layout.formChipRadius,
              backgroundColor: formLetterBg[l],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text71 variant="label16" testID={`form-letter-${side}`}>{l}</Text71>
          </View>
        ))}
      </View>
    </View>
  );
}

function Form({ p, match }: { p: PrematchFull; match: Match }) {
  if (formLetters(p.form.home).length === 0 && formLetters(p.form.away).length === 0) return null;
  return (
    <View style={{ gap: space.s8 }}>
      <SectionBar label="Forma · últimos 5" />
      {sidesOf(match).map(({ side, team, crest }) => (
        <FormRow key={side} team={team} crest={crest} form={p.form[side]} side={side} />
      ))}
    </View>
  );
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Barra proporcional V/E/D: vitórias do Sporting, empates e vitórias do adversário (4933:7373). Sem resultados, não aparece. */
function HeadToHead({ p, match }: { p: PrematchFull; match: Match }) {
  const [sporting, opponent] = sidesOf(match);
  const games = [...p.h2h].sort((a, b) => b.kickoff.getTime() - a.kickoff.getTime()).slice(0, 5);
  const t = h2hTally(games, sporting.team.id, opponent.team.id);
  const segments = [
    { key: 'sporting', n: t.sporting, label: plural(t.sporting, 'vitória Sporting', 'vitórias Sporting'), color: colors.primary },
    { key: 'draws', n: t.draws, label: plural(t.draws, 'empate', 'empates'), color: colors.surface20 },
    {
      key: 'opponent',
      n: t.opponent,
      label: plural(t.opponent, `vitória ${opponent.team.name}`, `vitórias ${opponent.team.name}`),
      color: colors.surface10,
    },
  ].filter((x) => x.n > 0);
  if (segments.length === 0) return null;
  return (
    <View style={{ gap: space.s8 }}>
      <SectionBar label="Confrontos diretos · últimos 5" />
      <View testID="h2h-bar" accessible accessibilityLabel={segments.map((x) => x.label).join(', ')} style={{ flexDirection: 'row', gap: layout.h2hBarGap }}>
        {segments.map((x) => (
          <View key={x.key} testID={`h2h-${x.key}`} style={{ flexGrow: x.n, flexShrink: 1, flexBasis: 0, minWidth: 0, gap: layout.h2hLabelGap }}>
            <View style={{ height: layout.h2hBarHeight, borderRadius: layout.h2hBarRadius, backgroundColor: x.color }} />
            <Text71 variant="caption12" color="textMuted">{x.label}</Text71>
          </View>
        ))}
      </View>
    </View>
  );
}

function Injuries({ doc, match }: { doc: InjuriesDoc; match: Match }) {
  const teams = sidesOf(match)
    .map(({ team }) => ({ team, items: doc.items.filter((i) => i.teamId === team.id) }))
    .filter((t) => t.items.length > 0);
  return (
    <View style={{ gap: space.s8 }}>
      <SectionBar label="Ausências" />
      {teams.map(({ team, items }) => (
        <View key={team.id} style={{ gap: space.s8 }}>
          <Text71 variant="caption12" color="textSubtle" numberOfLines={1}>{team.name}</Text71>
          {items.map((i, n) => {
            const reason = absenceReasonText(i.type, i.reason);
            return (
              <View key={`${team.id}-${i.playerId}-${n}`} testID="absence-row" style={{ flexDirection: 'row', alignItems: 'center', gap: space.s8 }}>
                <Text71 variant="strong14" numberOfLines={1} style={{ flexShrink: 1 }}>{i.name}</Text71>
                <Text71 variant="caption12" color="textMuted" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>{reason}</Text71>
                {isDoubtful(i.type) ? (
                  <View
                    testID="doubt-badge"
                    style={{
                      backgroundColor: colors.yellow71Bg,
                      borderRadius: layout.tlBadgeRadius,
                      paddingHorizontal: layout.tlBadgePadX,
                      paddingVertical: layout.tlBadgePadY,
                    }}
                  >
                    <Text71 variant="badge11" color="yellow71">Dúvida</Text71>
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

function PreMatch({ match }: { match: Match }) {
  const prematch = useMatchDetail(match.id, 'prematch');
  const injuries = useMatchDetail(match.id, 'injuries');
  if (prematch.status === 'loading' || injuries.status === 'loading') return null;
  const full = prematch.status === 'ready' && !isPrematchEmpty(prematch.data) ? prematch.data : null;
  const injuriesDoc = injuries.status === 'ready' ? injuries.data : null;
  const known = new Set([match.home.id, match.away.id]);
  const hasInjuries = !!injuriesDoc && injuriesDoc.items.some((i) => known.has(i.teamId));
  if (!full && !hasInjuries) {
    // Uma leitura falhada nunca se mostra como "sem dados".
    const failed = prematch.status === 'error' || injuries.status === 'error';
    return failed ? <EmptyState icon="info" text={LOAD_ERROR} /> : <EmptyState text={EMPTY_PREMATCH} />;
  }
  return (
    <>
      {full ? (
        <>
          <Form p={full} match={match} />
          <HeadToHead p={full} match={match} />
        </>
      ) : prematch.status === 'error' ? (
        <EmptyState icon="info" text={LOAD_ERROR} />
      ) : (
        <Text71 variant="body14" color="textMuted" style={{ textAlign: 'center' }}>{PREMATCH_PENDING}</Text71>
      )}
      {injuriesDoc && hasInjuries ? <Injuries doc={injuriesDoc} match={match} /> : null}
    </>
  );
}

/** Jogo terminado (Figma 08; o 06, ao vivo, mostra outro conteúdo): Forma, Confrontos diretos e Ausências por baixo da cronologia, só com dados e sem Previsão nem avisos. */
function MatchContext({ match }: { match: Match }) {
  const prematch = useMatchDetail(match.id, 'prematch');
  const injuries = useMatchDetail(match.id, 'injuries');
  const full = prematch.status === 'ready' && !isPrematchEmpty(prematch.data) ? prematch.data : null;
  const injuriesDoc = injuries.status === 'ready' ? injuries.data : null;
  const known = new Set([match.home.id, match.away.id]);
  const hasInjuries = !!injuriesDoc && injuriesDoc.items.some((i) => known.has(i.teamId));
  if (!full && !hasInjuries) return null;
  return (
    <>
      {full ? (
        <>
          <Form p={full} match={match} />
          <HeadToHead p={full} match={match} />
        </>
      ) : null}
      {injuriesDoc && hasInjuries ? <Injuries doc={injuriesDoc} match={match} /> : null}
    </>
  );
}

/** Jogo terminado (frame 08). `after` (o contexto do jogo) só aparece depois de os eventos chegarem, para a página não saltar, e nunca por baixo do erro. */
function Events({ match, after }: { match: Match; after?: ReactNode }) {
  const events = useMatchDetail(match.id, 'events');
  if (events.status === 'loading') return null;
  if (events.status === 'error') return <EmptyState icon="info" text={LOAD_ERROR} />;
  const items = events.status === 'ready' ? events.data.items : [];
  if (items.length === 0) return <><EmptyState icon="info" text={NO_EVENTS_DONE} />{after}</>;
  // 20/11: as partes jogadas aparecem sempre por ordem (a 1.ª primeiro), mesmo uma parte sem lances.
  const groups = groupEvents(items, match.home.id, match.sportingSide, playedParts(match.status));
  return (
    <>
      {groups.map((g) => (
        <View key={g.label}>
          <SectionBar label={g.label} right={g.score} />
          {g.events.length === 0 ? (
            <Text71 testID="part-empty" variant="caption12" color="textMuted" style={{ paddingVertical: space.s12 }}>
              {NO_EVENTS_PART}
            </Text71>
          ) : (
            g.events.map((e, i) => <EventRow key={i} event={e} />)
          )}
        </View>
      ))}
      {after}
    </>
  );
}

function MatchInfo({ match }: { match: Match }) {
  const v = match.venue;
  const doc = useVenue(v?.id ?? null);
  const extra = doc.status === 'ready' ? doc.data : null;
  const city = v?.city ?? extra?.city ?? null;
  const capacity = v?.capacity ?? extra?.capacity ?? null;
  const image = v?.image ?? extra?.image ?? null;
  if (!match.referee && !v) return null;
  return (
    <>
      <SectionBar label="Informação do Jogo" />
      {match.referee ? <InfoRow label="Árbitro" value={match.referee} /> : null}
      {v ? <InfoRow label="Local" value={city ? `${v.name} (${city})` : v.name} /> : null}
      {capacity != null ? <InfoRow label="Capacidade" value={capacityText(capacity)} /> : null}
      {image ? (
        <Image
          testID="venue-photo"
          source={{ uri: image }}
          contentFit="cover"
          accessible={false}
          style={{ width: '100%', aspectRatio: layout.venuePhotoAspect, borderRadius: radius.md }}
        />
      ) : null}
    </>
  );
}

export function SummaryTab({ match }: { match: Match }) {
  const state = uiState(match.status);
  return (
    <MatchScrollView
      testID="summary-tab"
      contentContainerStyle={{ paddingHorizontal: space.s24, paddingBottom: space.s32, gap: space.s16 }}
    >
      {state === 'scheduled' ? (
        <>
          <PredictionCard match={match} />
          <FansPrediction match={match} />
          <PreMatch match={match} />
        </>
      ) : state === 'postponed' ? (
        <EmptyState icon="info" text={POSTPONED} />
      ) : state === 'cancelled' ? (
        <EmptyState icon="info" text={CANCELLED} />
      ) : state === 'finished' ? (
        <>
          <FansPrediction match={match} />
          <MyStory match={match} />
          <Events match={match} after={<MatchContext match={match} />} />
        </>
      ) : (
        <>
          <FansPrediction match={match} />
          <LiveNumbers match={match} />
          <LiveEvents match={match} />
        </>
      )}
      <MatchInfo match={match} />
    </MatchScrollView>
  );
}
