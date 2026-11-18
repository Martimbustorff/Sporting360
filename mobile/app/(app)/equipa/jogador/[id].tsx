// SEM FIGMA: o Figma não tem frame do jogador (Mapa do Figma do Plano 4). Compõe Header ("Jogador"), foto redonda
// de 96 px (`layout.playerPhoto`, círculo surface10 sem foto), nome em DIN 24 (`sectionScore`, uma linha com reticências)
// e "N.º 9, Avançado, 24 anos" a muted; depois `SectionBar` e `InfoRow` (655:31905 / 655:31960) para os números da
// época, e `TextRow` (TeamRows) para os troféus e o histórico de lesões.
// O id é o da API-Football (Formações e Plantel abrem `/equipa/jogador/{id}`). O jogador vem do plantel ou, se já
// saiu, da linha de estatísticas da época. Plantel ou estatísticas a falhar: erro no ecrã, nunca "Sem jogos esta
// época."; troféus ou lesões a falhar: "Não foi possível carregar esta secção." só nessa secção.
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { OfflineBanner } from '@/components/OfflineBanner';
import { Screen } from '@/components/Screen';
import { InfoRow, SectionBar } from '@/components/SectionBar';
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
  seasonLabel,
  sidelinedPeriodText,
  trophyPlaceText,
} from '@/lib/team';
import { Body, Display } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';

const ERROR_TEXT = 'Não foi possível carregar os dados.';
const NOT_FOUND = 'Jogador não encontrado.';
const NO_GAMES = 'Sem jogos esta época.';
const NO_TROPHIES = 'Sem troféus registados.';
const NO_INJURIES = 'Sem lesões registadas.';

const param = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

/** SEM FIGMA: enquanto os dados não chegam, um espaço em branco (como na competição). */
const Loading = () => <View testID="player-loading" />;

function Muted({ text }: { text: string }) {
  return <Body variant="body" style={{ textAlign: 'center', opacity: layout.mutedOpacity }}>{text}</Body>;
}

function Photo({ uri }: { uri: string | null }) {
  const box = { width: layout.playerPhoto, height: layout.playerPhoto, borderRadius: layout.playerPhoto / 2 };
  if (!uri) return <View testID="player-photo" style={{ ...box, backgroundColor: colors.surface10 }} />;
  return <Image testID="player-photo" source={{ uri }} contentFit="cover" accessibilityIgnoresInvertColors style={box} />;
}

function SeasonNumbers({ line }: { line: PlayerSeasonStats }) {
  const rows: [string, string][] = [
    ['Jogos', String(line.appearances)],
    ['Minutos', capacityText(line.minutes)],
    ['Golos', String(line.goals)],
    ['Assistências', String(line.assists)],
    ['Nota média', ratingText(line.rating)],
    ['Cartões amarelos', String(line.yellow)],
    ['Cartões vermelhos', String(line.red)],
  ];
  return (
    <View>
      {rows.map(([label, value]) => (
        <View key={label} accessible accessibilityLabel={`${label}: ${value}`}>
          <InfoRow label={label} value={value} />
        </View>
      ))}
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
    const facts = [
      member?.number != null ? `N.º ${member.number}` : '',
      playerPositionLabel(member?.position ?? null),
      member?.age != null ? `${member.age} anos` : '',
    ].filter(Boolean);
    const line = playerSeasonLine(statsDoc, id);
    const won = trophies.status === 'ready' ? (trophies.data.byPlayer[id] ?? []) : [];
    const injuries = sidelined.status === 'ready' ? (sidelined.data.byPlayer[id] ?? []) : [];
    const fromCache = reads.some((r) => r.status === 'ready' && r.fromCache === true);
    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingBottom: spacing.xl, gap: spacing.md }}>
        <OfflineBanner visible={fromCache} />
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.md }}>
          <Photo uri={photo} />
          <Display variant="sectionScore" numberOfLines={1} ellipsizeMode="tail" style={{ textAlign: 'center', alignSelf: 'stretch' }}>
            {name}
          </Display>
          {facts.length > 0 ? <Muted text={facts.join(', ')} /> : null}
        </View>
        <SectionBar label={`Época ${seasonLabel(season)}`} />
        {line ? <SeasonNumbers line={line} /> : <Muted text={NO_GAMES} />}
        <SectionBar label="Troféus" />
        {trophies.status === 'error' ? (
          <SectionError />
        ) : trophies.status === 'loading' ? null : won.length > 0 ? (
          <View>
            {won.map((t, i) => (
              <TextRow key={`${t.league}-${t.season}-${i}`} left={`${t.league} ${t.season}`} right={trophyPlaceText(t.place)} />
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
      <Header title="Jogador" onBack={back} />
      {body}
    </Screen>
  );
}
