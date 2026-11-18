// Figma: nós 655:31904 (lances por parte: SectionBar "1ª Parte" + "0-0" e EventRows), 655:31958 (barra
// "Informação do Jogo") e 655:31960 (linha "Árbitro" / valor), 500:28950 (jogo futuro sem dados: ícone
// Calendar_Check 500:29854 e "Disponível no dia de jogo", o EmptyState do Plano 3).
// SEM FIGMA: o bloco de pré-jogo (Previsão, Forma, Confrontos diretos, Lesionados e suspensos), composto
// com as mesmas SectionBar e linhas do 655:31904/655:31960; o aviso "Pré-jogo ainda não disponível.";
// as mensagens de adiado, cancelado e sem lances (EmptyState `info`); as linhas Capacidade e a fotografia
// do estádio. A barra "TV/Transmissão Online" (655:31954) fica de fora: `matches` não tem canal de TV.
// O texto `advice` da API (inglês) nunca se mostra.
import { Image } from 'expo-image';
import { ScrollView, View } from 'react-native';
import { EmptyState } from '@/components/EmptyState';
import { EventRow } from '@/components/EventRow';
import { InfoRow, SectionBar } from '@/components/SectionBar';
import type { InjuriesDoc, Match } from '@/data/schemas';
import { useMatchDetail, useVenue } from '@/data/sports';
import { groupEvents, uiState } from '@/lib/matchVM';
import {
  capacityText,
  formLetters,
  h2hDate,
  injuryText,
  isPrematchEmpty,
  type FormLetter,
  type PrematchFull,
} from '@/lib/prematch';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

const EMPTY_PREMATCH = 'Disponível no dia de jogo';
const PREMATCH_PENDING = 'Pré-jogo ainda não disponível.';
const POSTPONED = 'Jogo adiado. A nova data aparece aqui quando for conhecida.';
const CANCELLED = 'Jogo cancelado.';
const NO_EVENTS_LIVE = 'Os lances aparecem aqui durante o jogo.';
const NO_EVENTS_DONE = 'Sem lances registados.';

const LETTER_BG: Record<FormLetter, string> = { V: colors.primary, E: colors.surface20, D: colors.cardRed };

/** Uma linha de texto: nome à esquerda, valor à direita (como o 655:31960, mas só com `body`). */
function TextRow({ left, right, muted }: { left: string; right: string; muted?: boolean }) {
  return (
    <View
      style={{
        minHeight: layout.minTouch,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <Body variant="body" numberOfLines={1} style={{ flexShrink: 1 }}>{left}</Body>
      <Body variant="body" style={{ textAlign: 'right', opacity: muted ? layout.mutedOpacity : 1 }}>{right}</Body>
    </View>
  );
}

function Prediction({ p, match }: { p: PrematchFull; match: Match }) {
  const cols = [
    { label: match.home.name, value: p.percent.home },
    { label: 'Empate', value: p.percent.draw },
    { label: match.away.name, value: p.percent.away },
  ];
  return (
    <>
      <SectionBar label="Previsão" />
      <View style={{ flexDirection: 'row', paddingHorizontal: spacing.md, gap: spacing.sm }}>
        {cols.map((c) => (
          <View key={c.label} style={{ flex: 1, alignItems: 'center', gap: spacing.xs }}>
            <Display variant="sectionScore">{`${c.value}%`}</Display>
            <Body variant="body" numberOfLines={1} style={{ opacity: layout.mutedOpacity }}>{c.label}</Body>
          </View>
        ))}
      </View>
    </>
  );
}

function FormRow({ name, form, side }: { name: string; form: string; side: 'home' | 'away' }) {
  const letters = formLetters(form);
  if (letters.length === 0) return null;
  return (
    <View
      style={{
        minHeight: layout.minTouch,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <Body variant="body" numberOfLines={1} style={{ flexShrink: 1 }}>{name}</Body>
      <View
        testID={`form-${side}`}
        accessible
        accessibilityLabel={`Forma: ${letters.join(' ')}`}
        style={{ flexDirection: 'row', gap: layout.formChipGap }}
      >
        {letters.map((l, i) => (
          <View
            key={i}
            style={{
              width: layout.formChip,
              height: layout.formChip,
              borderRadius: radius.sm,
              backgroundColor: LETTER_BG[l],
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Body variant="badge" testID={`form-letter-${side}`}>{l}</Body>
          </View>
        ))}
      </View>
    </View>
  );
}

function Form({ p, match }: { p: PrematchFull; match: Match }) {
  if (formLetters(p.form.home).length === 0 && formLetters(p.form.away).length === 0) return null;
  return (
    <>
      <SectionBar label="Forma" />
      <FormRow name={match.home.name} form={p.form.home} side="home" />
      <FormRow name={match.away.name} form={p.form.away} side="away" />
    </>
  );
}

function HeadToHead({ p }: { p: PrematchFull }) {
  const games = [...p.h2h].sort((a, b) => b.kickoff.getTime() - a.kickoff.getTime()).slice(0, 5);
  if (games.length === 0) return null;
  return (
    <>
      <SectionBar label="Confrontos diretos" />
      {games.map((g) => {
        const score = g.score.home == null || g.score.away == null ? '-' : `${g.score.home}-${g.score.away}`;
        return (
          <View
            key={g.id}
            style={{ minHeight: layout.minTouch, paddingHorizontal: spacing.md, justifyContent: 'center', gap: spacing.xs }}
          >
            <Body variant="body" style={{ opacity: layout.mutedOpacity }}>{h2hDate(g.kickoff)}</Body>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Body variant="body" numberOfLines={1} style={{ flex: 1 }}>{g.home.name}</Body>
              <Display variant="minute">{score}</Display>
              <Body variant="body" numberOfLines={1} style={{ flex: 1, textAlign: 'right' }}>{g.away.name}</Body>
            </View>
          </View>
        );
      })}
    </>
  );
}

function Injuries({ doc, match }: { doc: InjuriesDoc; match: Match }) {
  const teams = [match.home, match.away]
    .map((t) => ({ team: t, items: doc.items.filter((i) => i.teamId === t.id) }))
    .filter((t) => t.items.length > 0);
  return (
    <>
      <SectionBar label="Lesionados e suspensos" />
      {teams.map(({ team, items }) => (
        <View key={team.id}>
          <Body variant="tab" style={{ paddingHorizontal: spacing.md, opacity: layout.mutedOpacity }}>{team.name}</Body>
          {items.map((i) => (
            <TextRow key={i.playerId} left={i.name} right={injuryText(i.type ?? '', i.reason ?? '')} muted />
          ))}
        </View>
      ))}
    </>
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
  if (!full && !hasInjuries) return <EmptyState text={EMPTY_PREMATCH} />;
  return (
    <>
      {full ? (
        <>
          <Prediction p={full} match={match} />
          <Form p={full} match={match} />
          <HeadToHead p={full} />
        </>
      ) : (
        <Body variant="body" style={{ textAlign: 'center', opacity: layout.mutedOpacity }}>{PREMATCH_PENDING}</Body>
      )}
      {injuriesDoc && hasInjuries ? <Injuries doc={injuriesDoc} match={match} /> : null}
    </>
  );
}

function Events({ match, live }: { match: Match; live: boolean }) {
  const events = useMatchDetail(match.id, 'events');
  if (events.status === 'loading') return null;
  const groups = events.status === 'ready' ? groupEvents(events.data.items, match.home.id) : [];
  if (groups.length === 0) return <EmptyState icon="info" text={live ? NO_EVENTS_LIVE : NO_EVENTS_DONE} />;
  return (
    <>
      {groups.map((g) => (
        <View key={g.label} style={{ gap: spacing.md }}>
          <SectionBar label={g.label} right={g.score} />
          {g.events.map((e, i) => (
            <EventRow key={i} event={e} />
          ))}
        </View>
      ))}
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
    <ScrollView
      testID="summary-tab"
      contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      {state === 'scheduled' ? (
        <PreMatch match={match} />
      ) : state === 'postponed' ? (
        <EmptyState icon="info" text={POSTPONED} />
      ) : state === 'cancelled' ? (
        <EmptyState icon="info" text={CANCELLED} />
      ) : (
        <Events match={match} live={state !== 'finished'} />
      )}
      <MatchInfo match={match} />
    </ScrollView>
  );
}
