// Figma V7.1: frame 42 "Jogador" (4950:8462). Header "JOGADOR"; cabeça com a foto de 84 (`PlayerPhoto`, 4959:9550), o número em
// Title 24 primary-on-dark junto ao nome em Title 24 e a linha "Extremo · 25 anos" em Caption 12 muted; quatro quadrados
// (JOGOS, GOLOS, ASSIST., NOTA a primary; surface-06, raio 12, 12 em cima e em baixo); linhas com `InfoRow`; TROFÉUS com o ícone
// (4950:8548) e HISTÓRICO DE LESÕES, "Sem lesões registadas." em Caption 12 muted.
// Diferenças do frame: a linha de facto não leva nacionalidade (o plantel não a tem); as linhas Remates à baliza, Passes-chave e Dribles
// certos não existem nos dados e não se mostram; ficam Minutos e os cartões amarelos e vermelhos (copy já existente).
// SEM FIGMA: o aviso de cache, o erro, "Jogador não encontrado.", "Sem jogos esta época.", "Sem troféus registados." e o erro de
// secção. O número só se mostra com número no plantel.
// O id é o da API-Football (Formações e Plantel abrem `/equipa/jogador/{id}`). O jogador vem do plantel ou, se já
// saiu, da linha de estatísticas da época. Plantel ou estatísticas a falhar: erro no ecrã, nunca "Sem jogos esta
// época."; troféus ou lesões a falhar: "Não foi possível carregar esta secção." só nessa secção.
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PlayerPhoto } from '@/components/PlayerPhoto';
import { Screen } from '@/components/Screen';
import { InfoRow, SectionBar } from '@/components/SectionBar';
import { ScreenSkeleton } from '@/components/Skeleton';
import { SectionError, TextRow } from '@/components/TeamRows';
import { useNow } from '@/data/clock';
import type { PlayerSeasonStats } from '@/data/schemas';
import { usePlayerStats, useTeamData } from '@/data/sports';
import { footballSeason } from '@/lib/periods';
import { capacityText, injuryReasonText } from '@/lib/prematch';
import {
  playerPositionLabel,
  playerSeasonLine,
  ratingText,
  sidelinedPeriodText,
  trophyPlaceText,
} from '@/lib/team';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

const ERROR_TEXT = 'Não foi possível carregar os dados.';
const NOT_FOUND = 'Jogador não encontrado.';
const NO_GAMES = 'Sem jogos esta época.';
const NO_TROPHIES = 'Sem troféus registados.';
const NO_INJURIES = 'Sem lesões registadas.';

const param = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** Enquanto os dados não chegam: o esqueleto de 42c (4994:13069). */
const Loading = () => <ScreenSkeleton testID="player-loading" />;

function Muted({ text }: { text: string }) {
  return <Text71 variant="caption12" color="textMuted">{text}</Text71>;
}

function Tile({ label, value, accent = false, a11y }: { label: string; value: string; accent?: boolean; a11y: string }) {
  return (
    <View
      accessible
      accessibilityLabel={a11y}
      style={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        gap: layout.playerNameGap / 2,
        paddingVertical: layout.playerTilePadY,
        borderRadius: layout.tieCardRadius,
        backgroundColor: colors.surface06,
      }}
    >
      <Text71 variant="title24" color={accent ? 'primary' : 'white'} numberOfLines={1}>{value}</Text71>
      <Text71 variant="badge11" color="textSubtle" numberOfLines={1}>{label}</Text71>
    </View>
  );
}

function SeasonNumbers({ line }: { line: PlayerSeasonStats }) {
  const rating = ratingText(line.rating);
  const rows: [string, string][] = [
    ['Minutos', capacityText(line.minutes)],
    ['Cartões amarelos', String(line.yellow)],
    ['Cartões vermelhos', String(line.red)],
  ];
  return (
    <View style={{ gap: space.s12 }}>
      <View style={{ flexDirection: 'row', gap: layout.playerTileGap }}>
        <Tile label="Jogos" value={String(line.appearances)} a11y={`Jogos: ${line.appearances}`} />
        <Tile label="Golos" value={String(line.goals)} a11y={`Golos: ${line.goals}`} />
        <Tile label="Assist." value={String(line.assists)} a11y={`Assistências: ${line.assists}`} />
        <Tile label="Nota" value={rating} accent a11y={`Nota média: ${rating}`} />
      </View>
      <View>
        {rows.map(([label, value]) => (
          <View key={label} accessible accessibilityLabel={`${label}: ${value}`}>
            <InfoRow label={label} value={value} />
          </View>
        ))}
      </View>
    </View>
  );
}

export default function Jogador() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = param(params.id) ?? '';
  const now = useNow();
  const season = useMemo(() => footballSeason(now), [now]);
  const squad = useTeamData('squad');
  const stats = usePlayerStats(season);
  const trophies = useTeamData('trophies');
  const sidelined = useTeamData('sidelined');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));

  // Plantel e estatísticas decidem o ecrã (quem é o jogador e os números da época); troféus e lesões são
  // secundários e falham só na sua secção.
  const primary = [squad, stats];
  const reads = [squad, stats, trophies, sidelined];
  const body = (() => {
    if (primary.some((r) => r.status === 'loading')) return <Loading />;
    if (primary.some((r) => r.status === 'error')) return <EmptyState icon="info" text={ERROR_TEXT} />;
    const member = squad.status === 'ready' ? squad.data.players.find((p) => p.id === id) : undefined;
    const statsDoc = stats.status === 'ready' ? stats.data : null;
    const anyLine = statsDoc?.players.find((p) => p.id === id);
    if (!member && !anyLine) return <EmptyState icon="info" text={NOT_FOUND} />;
    const name = member?.name ?? anyLine?.name ?? '';
    const photo = member?.photo ?? anyLine?.photo ?? null;
    const number = member?.number ?? null;
    const facts = [playerPositionLabel(member?.position ?? null), member?.age != null ? `${member.age} anos` : ''].filter(Boolean);
    const line = playerSeasonLine(statsDoc, id);
    const won = trophies.status === 'ready' ? (trophies.data.byPlayer[id] ?? []) : [];
    const injuries = sidelined.status === 'ready' ? (sidelined.data.byPlayer[id] ?? []) : [];
    const fromCache = reads.some((r) => r.status === 'ready' && r.fromCache === true);
    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.s24, paddingBottom: space.s32, gap: space.s12 }}>
        <OfflineBanner visible={fromCache} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.playerHeaderGap, paddingTop: space.s12 }}>
          <PlayerPhoto testID="player-photo" photo={photo} size={layout.playerHeaderPhoto} shape="rounded" />
          <View style={{ flex: 1, minWidth: 0, gap: layout.playerNameGap / 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: layout.playerNameGap }}>
              {number !== null ? (
                <Text71 variant="title24" color="primaryOnDark" testID="player-shirt" style={{ flexShrink: 0 }}>{String(number)}</Text71>
              ) : null}
              <Text71 variant="title24" numberOfLines={1} ellipsizeMode="tail" style={{ flexShrink: 1 }}>{name}</Text71>
            </View>
            {facts.length > 0 ? <Muted text={facts.join(' · ')} /> : null}
          </View>
        </View>
        {line ? <SeasonNumbers line={line} /> : <Muted text={NO_GAMES} />}
        <SectionBar label="Troféus" />
        {trophies.status === 'error' ? (
          <SectionError />
        ) : trophies.status === 'loading' ? null : won.length > 0 ? (
          <View>
            {won.map((t, i) => (
              <TextRow key={`${t.league}-${t.season}-${i}`} icon left={`${t.league} · ${t.season}`} right={trophyPlaceText(t.place)} />
            ))}
          </View>
        ) : (
          <Muted text={NO_TROPHIES} />
        )}
        <SectionBar label="Histórico de lesões" />
        {sidelined.status === 'error' ? (
          <SectionError />
        ) : sidelined.status === 'loading' ? null : injuries.length > 0 ? (
          <View>
            {injuries.map((s, i) => (
              <TextRow key={`${s.start}-${i}`} left={injuryReasonText(s.type)} right={sidelinedPeriodText(s)} />
            ))}
          </View>
        ) : (
          <Muted text={NO_INJURIES} />
        )}
      </ScrollView>
    );
  })();

  return (
    <Screen padded="none">
      <Header title="JOGADOR" onBack={back} />
      {body}
    </Screen>
  );
}
