// Figma V7.1 22 Perfil (4942:7608). Compõe `Header`, `SectionBar`/`InfoRow` (4942:7656 / 4942:7659), `Tabs` 'equal'
// (4942:7676), `PlayerPhoto` (4959:9550) e `MenuRow` M (4942:7733); mosaicos, histórico e avatar com tokens.
// - Cabeçalho público: avatar com a inicial do nome público (`avatarId` continua a ser lido para as imagens entrarem
//   depois), nome público ("Maria C.") e "Editar" → /perfil/nome.
// - O email nunca aparece aqui (só em Definições, Conta). O nome completo do `users` também não.
// - "Sócio desde" vem de `users.partnerNumber` (MM/AAAA); o número de sócio é `memberNumber`. A carregar: esqueleto;
//   leitura falhada: erro da secção; "Não indicado" só com o documento lido e o campo vazio.
// - Jogador favorito com `PlayerPhoto` (foto e número vêm do plantel, `teams/228/data/squad`; sem foto, silhueta).
// - "Meu jogo": pontos e posição do período; acerto, exatos, MVPs certos, série e histórico (lib/myGame).
// - Leitura falhada mostra erro, nunca a mensagem de vazio.
import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Header } from '@/components/Header';
import { MenuRow } from '@/components/MenuRow';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PlayerPhoto } from '@/components/PlayerPhoto';
import { initialOf } from '@/lib/initialOf';
import { Screen } from '@/components/Screen';
import { InfoRow, SectionBar } from '@/components/SectionBar';
import { Tabs } from '@/components/Tabs';
import { Touchable } from '@/components/Touchable';
import { useNow } from '@/data/clock';
import { useMyUser, usePublicProfile, type Loadable } from '@/data/hooks';
import { useMyPosition } from '@/data/myPosition';
import type { PublicProfile, UserDoc } from '@/data/schemas';
import { useTeamData } from '@/data/sports';
import {
  useMyLeaderboardEntry,
  useMyPointEvents,
  useMyPredictions,
  useSettlements,
  type PeriodKind,
} from '@/data/user';
import { myGameStats, type MyGameHistoryItem, type MyGameStats } from '@/lib/myGame';
import { periodKeys } from '@/lib/periods';
import { formatDayMonth } from '@/lib/ptDate';
import { publicName } from '@/lib/publicName';
import { sportLabel } from '@/lib/sports';
import { useSession } from '@/providers/SessionProvider';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

const TABS: { key: PeriodKind; label: string }[] = [
  { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mês' },
  { key: 'season', label: 'Época' },
];
const PERIOD_TEXT: Record<PeriodKind, string> = { week: 'nesta semana', month: 'neste mês', season: 'nesta época' };
const NOT_SET = 'Não indicado';

export const PERFIL_TEXT = {
  gameError: 'Não foi possível carregar o teu jogo.',
  sectionError: 'Não foi possível carregar esta secção.',
  noSettled: 'Ainda sem jogos liquidados.',
  positionError: 'Não foi possível carregar a tua posição.',
  noPoints: (kind: PeriodKind) => `Ainda não pontuaste ${PERIOD_TEXT[kind]}.`,
  settled: (n: number) => (n === 1 ? '1 jogo liquidado' : `${n} jogos liquidados`),
  publicNameHint: 'Nome público no Ranking',
} as const;

const pointsText = (n: number) => (n === 1 ? '1 ponto' : `${n} pontos`);

/** Nome público: o de `publicProfiles`; sem ele, a mesma regra do servidor ("Maria C."). Vazio enquanto carrega. */
function shownName(uid: string | null, profile: Loadable<PublicProfile>, user: Loadable<UserDoc>): string {
  if (!uid) return '';
  if (profile.status === 'ready') return profile.data.displayName;
  if (profile.status === 'loading' || user.status === 'loading') return '';
  const u = user.status === 'ready' ? user.data : {};
  return publicName({ displayName: u.displayName ?? null, name: u.name ?? null }, uid);
}

const text = (v: string | number | null | undefined): string => {
  const s = v == null ? '' : String(v).trim();
  return s === '' ? NOT_SET : s;
};

function Note({ text: t, testID }: { text: string; testID?: string }) {
  return (
    <Text71 variant="caption12" color="textSubtle" testID={testID}>
      {t}
    </Text71>
  );
}

function LinkText({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Touchable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={{ minHeight: layout.minTouch, minWidth: layout.minTouch, justifyContent: 'center', alignItems: 'center' }}>
      <Text71 variant="captionStrong12" color="primaryOnDark">{label}</Text71>
    </Touchable>
  );
}

/** Círculo com a inicial. `avatarId` fica lido para, mais tarde, mostrar a imagem do avatar escolhido. */
function Avatar({ name }: { name: string; avatarId: string | null }) {
  return (
    <View
      testID="perfil-avatar"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: layout.profileAvatar,
        height: layout.profileAvatar,
        borderRadius: layout.profileAvatar / 2,
        backgroundColor: colors.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text71 variant="title24" testID="perfil-avatar-initial">{name ? initialOf(name) : ''}</Text71>
    </View>
  );
}

/** PONTOS / POSIÇÃO (4942:7687): o primeiro em primary, o segundo em surface-06. */
function HeroTile({ label, value, testID, primary }: { label: string; value: string; testID: string; primary: boolean }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flex: 1,
        minWidth: 0,
        gap: layout.leaderTextGap,
        paddingHorizontal: layout.statTilePadX,
        paddingVertical: layout.statTilePadY,
        borderRadius: layout.statTileRadius,
        backgroundColor: primary ? colors.primary : colors.surface06,
      }}
    >
      <Text71 variant="eyebrow13" color={primary ? 'white' : 'textSubtle'} numberOfLines={1}>{label}</Text71>
      <Text71 variant="display40" numberOfLines={1} testID={testID}>{value}</Text71>
    </View>
  );
}

/** ACERTO / EXATOS / SÉRIE / MVP (4942:7694). */
function NumberTile({ label, a11y, value, testID }: { label: string; a11y: string; value: string; testID: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${a11y}: ${value}`}
      style={{
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        gap: layout.leaderTextGap,
        paddingVertical: space.s12,
        borderRadius: layout.numberTileRadius,
        backgroundColor: colors.surface06,
      }}
    >
      <Text71 variant="title24" numberOfLines={1} testID={testID}>{value}</Text71>
      <Text71 variant="badge11" color="textSubtle" numberOfLines={1}>{label}</Text71>
    </View>
  );
}

function HistoryRow({ item }: { item: MyGameHistoryItem }) {
  const date = formatDayMonth(item.gameDate);
  const result = item.final === null ? 'por liquidar' : `final ${item.final}`;
  const settled = item.final !== null;
  return (
    <View
      testID="history-row"
      accessible
      accessibilityLabel={`${date}, prognóstico ${item.pick}, ${result}, ${pointsText(item.points)}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s12,
        paddingVertical: layout.rankRowPadY,
        borderBottomWidth: layout.separator,
        borderBottomColor: colors.separator,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: layout.leaderTextGap }}>
        <Text71 variant="strong14" numberOfLines={1}>{settled ? `${date} · Final ${item.final}` : date}</Text71>
        <Text71 variant="caption12" color="textSubtle" numberOfLines={1}>{`O teu prognóstico: ${item.pick}`}</Text71>
      </View>
      <View
        style={{
          flexShrink: 0,
          paddingHorizontal: layout.historyBadgePadX,
          paddingVertical: layout.historyBadgePadY,
          borderRadius: layout.historyBadgeRadius,
          backgroundColor: settled && item.points > 0 ? colors.primary : colors.surface10,
        }}
      >
        <Text71 variant="badge11" numberOfLines={1}>{settled ? `+${item.points} PTS` : 'Por liquidar'}</Text71>
      </View>
    </View>
  );
}

/** Jogador favorito: linha de informação com `PlayerPhoto` (foto e número do plantel; sem foto, silhueta). */
function FavoritePlayerRow({ player }: { player: { id: string; name: string } | null | undefined }) {
  const squad = useTeamData('squad');
  const found = player && squad.status === 'ready' ? squad.data.players.find((p) => p.id === player.id) : undefined;
  return (
    <View
      style={{
        minHeight: layout.minTouch,
        paddingVertical: space.s12,
        borderBottomWidth: layout.separator,
        borderBottomColor: colors.separator,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s16,
      }}
    >
      <Text71 variant="body14" color="textMuted" style={{ flexShrink: 0 }}>Jogador favorito</Text71>
      <View style={{ flex: 1 }} />
      {player ? (
        <PlayerPhoto testID="favorite-player-photo" photo={found?.photo ?? null} size={layout.leaderRowPhoto} number={found?.number ?? null} />
      ) : null}
      <Text71 variant="strong14" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, textAlign: 'right' }}>
        {text(player?.name)}
      </Text71>
    </View>
  );
}

/** Linhas da secção Sócio. "Não indicado" só com o documento lido (ou inexistente) e o campo vazio. */
function MemberRows({ user }: { user: Loadable<UserDoc> }) {
  if (user.status === 'loading') return <View testID="socio-loading" style={{ minHeight: layout.skeletonRowHeight }} />;
  if (user.status === 'error') return <Note text={PERFIL_TEXT.sectionError} />;
  const u: UserDoc = user.status === 'ready' ? user.data : {};
  return (
    <View>
      <InfoRow singleLine label="Número de sócio" value={text(u.memberNumber)} />
      <InfoRow singleLine label="Sócio desde" value={text(u.partnerNumber)} />
      <InfoRow singleLine label="Lugar anual" value={text(u.seasonSeat)} />
      <InfoRow singleLine label="Modalidade favorita" value={u.favoriteSport ? sportLabel(u.favoriteSport) : NOT_SET} />
      <FavoritePlayerRow player={u.favoritePlayer} />
    </View>
  );
}

function PeriodBlock({ kind, uid }: { kind: PeriodKind; uid: string | null }) {
  const now = useNow();
  const key = periodKeys(now)[kind];
  const entry = useMyLeaderboardEntry(kind, key, uid);
  const points = entry.status === 'ready' ? entry.data.points : entry.status === 'missing' ? 0 : null;
  const position = useMyPosition(kind, key, entry.status === 'ready' ? entry.data.points : null);

  if (entry.status === 'loading') return <View testID="period-loading" style={{ minHeight: layout.rankingRowMinHeight }} />;
  return (
    <View style={{ gap: space.s8 }}>
      <View style={{ flexDirection: 'row', gap: space.s12 }}>
        {points !== null ? <HeroTile primary label="Pontos" value={String(points)} testID="period-points" /> : null}
        {typeof position === 'number' ? <HeroTile primary={false} label="Posição" value={`${position}.º`} testID="period-position" /> : null}
      </View>
      {entry.status === 'error' || position === 'error' ? <Note text={PERFIL_TEXT.positionError} /> : null}
      {entry.status === 'missing' ? <Note text={PERFIL_TEXT.noPoints(kind)} /> : null}
    </View>
  );
}

function GameStats({ stats }: { stats: MyGameStats }) {
  return (
    <View style={{ gap: space.s16 }}>
      <View style={{ gap: space.s8 }}>
        {stats.settled === 0 ? <Note text={PERFIL_TEXT.noSettled} /> : <Note text={PERFIL_TEXT.settled(stats.settled)} />}
        <View style={{ flexDirection: 'row', gap: layout.numberTileGap }}>
          {stats.accuracyPct !== null ? (
            <>
              <NumberTile label="Acerto" a11y="Acerto" value={`${stats.accuracyPct} %`} testID="stat-accuracy" />
              <NumberTile label="Exatos" a11y="Exatos" value={String(stats.exact)} testID="stat-exact" />
              <NumberTile label="Série" a11y="Série atual" value={String(stats.streak)} testID="stat-streak" />
            </>
          ) : null}
          <NumberTile label="MVP" a11y="MVPs certos" value={String(stats.mvpCorrect)} testID="stat-mvp" />
        </View>
      </View>
      {stats.history.length > 0 ? (
        <View>
          <SectionBar label="Histórico" />
          {stats.history.map((h) => (
            <HistoryRow key={h.gameId} item={h} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function Perfil() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const user = useMyUser(uid);
  const profile = usePublicProfile(uid);
  const [kind, setKind] = useState<PeriodKind>('week');

  const predictions = useMyPredictions(uid);
  const events = useMyPointEvents(uid);
  const gameIds = useMemo(
    () => (predictions.status === 'ready' ? predictions.data.map((p) => p.gameId) : []),
    [predictions],
  );
  const settlements = useSettlements(gameIds);
  const stats = useMemo(
    () =>
      predictions.status === 'ready' && events.status === 'ready' && settlements.status === 'ready'
        ? myGameStats({ predictions: predictions.data, settlements: settlements.data, events: events.data })
        : null,
    [predictions, events, settlements],
  );
  const reads = [predictions, events, settlements, user];
  const failed = predictions.status === 'error' || events.status === 'error' || settlements.status === 'error';
  const offline = reads.some((r) => r.status === 'ready' && r.fromCache === true);

  const name = shownName(uid, profile, user);
  const avatarId = profile.status === 'ready' ? profile.data.avatarId : null;

  return (
    <Screen padded="none">
      <Header title="Perfil" onBack={back} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: space.s24, paddingTop: space.s16, paddingBottom: space.s24, gap: space.s16 }}
      >
        <OfflineBanner visible={offline} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s16 }}>
          <Avatar name={name} avatarId={avatarId} />
          <View style={{ flex: 1, minWidth: 0, gap: layout.leaderTextGap }}>
            <Text71 variant="titleS20" testID="perfil-name" numberOfLines={1} ellipsizeMode="tail">
              {name}
            </Text71>
            <Text71 variant="caption12" color="textSubtle" numberOfLines={1}>{PERFIL_TEXT.publicNameHint}</Text71>
          </View>
          <LinkText label="Editar" a11y="Editar nome público" onPress={() => router.push('/perfil/nome')} />
        </View>

        <View>
          <SectionBar label="Sócio" right="Editar perfil" onRightPress={() => router.push('/perfil/editar')} />
          <MemberRows user={user} />
        </View>

        <View style={{ gap: space.s16 }}>
          <SectionBar label="Meu jogo" />
          <Tabs mode="equal" items={TABS} value={kind} onChange={setKind} />
          <PeriodBlock kind={kind} uid={uid} />
          {failed ? (
            <Note text={PERFIL_TEXT.gameError} />
          ) : stats === null ? (
            <View testID="game-loading" style={{ minHeight: layout.skeletonRowHeight }} />
          ) : (
            <GameStats stats={stats} />
          )}
        </View>

        <View>
          <MenuRow
            size="M"
            icon={<Feather name="bell" size={layout.menuRowIcon} color={colors.white} />}
            label="Preferências de notificação"
            onPress={() => router.push('/perfil/notificacoes')}
          />
          <MenuRow
            size="M"
            icon={<Feather name="trash-2" size={layout.menuRowIcon} color={colors.white} />}
            label="Apagar conta"
            onPress={() => router.push('/apagar-conta')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
