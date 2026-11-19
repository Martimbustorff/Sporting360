// SEM FIGMA: o Figma não tem frame do Perfil (Mapa do Figma do Plano 4: "Notícias, Ranking, Perfil"; sem referência
// raster). Compõe `Header`, `SectionBar`/`InfoRow` (655:31905 / 655:31960), `Tabs` 'equal' (500:28814, Semana, Mês,
// Época), `MenuRow` (564:7096) e `OfflineBanner`; o resto (avatar, mosaicos, histórico) com tokens.
// - Cabeçalho público: avatar com a inicial do nome público (decisão da Entrega 1, preflight F22; `avatarId` continua
//   a ser lido para as imagens entrarem depois), nome público ("Maria C.") e "Editar" → /perfil/nome.
// - O email nunca aparece aqui (só em Definições, Conta). O nome completo do `users` também não.
// - "Sócio desde" vem de `users.partnerNumber` (MM/AAAA); o número de sócio é `memberNumber`. A carregar: esqueleto;
//   leitura falhada: erro da secção; "Não indicado" só com o documento lido e o campo vazio.
// - "Meu jogo": pontos e posição do período; acerto, exatos, MVPs certos, série e histórico (lib/myGame).
// - Leitura falhada mostra erro, nunca a mensagem de vazio.
import Feather from '@expo/vector-icons/Feather';
import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { useRouter } from 'expo-router';
import { Header } from '@/components/Header';
import { MenuRow } from '@/components/MenuRow';
import { OfflineBanner } from '@/components/OfflineBanner';
import { initialOf } from '@/components/RankingRow';
import { Screen } from '@/components/Screen';
import { InfoRow, SectionBar } from '@/components/SectionBar';
import { Tabs } from '@/components/Tabs';
import { useNow } from '@/data/clock';
import { useMyUser, usePublicProfile, type Loadable } from '@/data/hooks';
import { useMyPosition } from '@/data/myPosition';
import type { PublicProfile, UserDoc } from '@/data/schemas';
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
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

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
    <Body variant="body" testID={testID} style={{ color: colors.textMuted }}>
      {t}
    </Body>
  );
}

function LinkText({ label, a11y, onPress }: { label: string; a11y: string; onPress: () => void }) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      hitSlop={spacing.sm}
      style={{ minHeight: layout.minTouch, justifyContent: 'center' }}
    >
      <Body variant="badge" style={{ color: colors.primary }}>{label}</Body>
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
        backgroundColor: colors.surface20,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Display variant="heroTitle" testID="perfil-avatar-initial">{name ? initialOf(name) : ''}</Display>
    </View>
  );
}

function StatTile({ label, value, testID }: { label: string; value: string; testID: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={{
        flexGrow: 1,
        flexBasis: layout.statTileMinWidth,
        backgroundColor: colors.surface10,
        borderRadius: radius.md,
        padding: spacing.md,
        gap: spacing.xs,
      }}
    >
      <Body variant="body" numberOfLines={1} style={{ color: colors.textMuted }}>{label}</Body>
      <Display variant="sectionScore" numberOfLines={1} testID={testID}>{value}</Display>
    </View>
  );
}

function HistoryRow({ item }: { item: MyGameHistoryItem }) {
  const date = formatDayMonth(item.gameDate);
  const result = item.final === null ? 'por liquidar' : `final ${item.final}`;
  return (
    <View
      testID="history-row"
      accessible
      accessibilityLabel={`${date}, prognóstico ${item.pick}, ${result}, ${pointsText(item.points)}`}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        minHeight: layout.rankingRowMinHeight,
        paddingHorizontal: spacing.md,
        borderBottomWidth: layout.separator,
        borderBottomColor: colors.divider,
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Body variant="body" numberOfLines={1}>{date}</Body>
        <Body variant="body" numberOfLines={1} style={{ color: colors.textMuted }}>
          {`Prognóstico ${item.pick} · ${item.final === null ? 'Por liquidar' : `Final ${item.final}`}`}
        </Body>
      </View>
      <Display variant="sectionScore" numberOfLines={1} style={{ flexShrink: 0 }}>{`+${item.points}`}</Display>
    </View>
  );
}

/** Linhas da secção Sócio. "Não indicado" só com o documento lido (ou inexistente) e o campo vazio. */
function MemberRows({ user }: { user: Loadable<UserDoc> }) {
  if (user.status === 'loading') return <View testID="socio-loading" style={{ minHeight: layout.skeletonRowHeight }} />;
  if (user.status === 'error') return <Note text={PERFIL_TEXT.sectionError} />;
  const u: UserDoc = user.status === 'ready' ? user.data : {};
  return (
    <>
      <InfoRow singleLine label="Número de sócio" value={text(u.memberNumber)} />
      <InfoRow singleLine label="Sócio desde" value={text(u.partnerNumber)} />
      <InfoRow singleLine label="Lugar anual" value={text(u.seasonSeat)} />
      <InfoRow singleLine label="Modalidade favorita" value={u.favoriteSport ? sportLabel(u.favoriteSport) : NOT_SET} />
      <InfoRow singleLine label="Jogador favorito" value={text(u.favoritePlayer?.name)} />
    </>
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
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        {points !== null ? <StatTile label="Pontos" value={String(points)} testID="period-points" /> : null}
        {typeof position === 'number' ? <StatTile label="Posição" value={`${position}.º`} testID="period-position" /> : null}
      </View>
      {entry.status === 'error' || position === 'error' ? <Note text={PERFIL_TEXT.positionError} /> : null}
      {entry.status === 'missing' ? <Note text={PERFIL_TEXT.noPoints(kind)} /> : null}
    </View>
  );
}

function GameStats({ stats }: { stats: MyGameStats }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {stats.settled === 0 ? (
        <Note text={PERFIL_TEXT.noSettled} />
      ) : (
        <Note text={PERFIL_TEXT.settled(stats.settled)} />
      )}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {stats.accuracyPct !== null ? (
          <>
            <StatTile label="Acerto" value={`${stats.accuracyPct} %`} testID="stat-accuracy" />
            <StatTile label="Exatos" value={String(stats.exact)} testID="stat-exact" />
            <StatTile label="Série atual" value={String(stats.streak)} testID="stat-streak" />
          </>
        ) : null}
        <StatTile label="MVPs certos" value={String(stats.mvpCorrect)} testID="stat-mvp" />
      </View>
      {stats.history.length > 0 ? (
        <View style={{ gap: spacing.sm }}>
          <SectionBar label="Histórico" />
          <View>
            {stats.history.map((h) => (
              <HistoryRow key={h.gameId} item={h} />
            ))}
          </View>
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
        contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingVertical: spacing.md, gap: spacing.md }}
      >
        <OfflineBanner visible={offline} />

        <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.profileHeaderGap }}>
          <Avatar name={name} avatarId={avatarId} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Display variant="heroTitle" testID="perfil-name" numberOfLines={1} ellipsizeMode="tail">
              {name}
            </Display>
            <LinkText label="Editar" a11y="Editar nome público" onPress={() => router.push('/perfil/nome')} />
          </View>
        </View>

        <View style={{ gap: spacing.xs }}>
          <SectionBar label="Sócio" />
          <MemberRows user={user} />
          <LinkText label="Editar perfil" a11y="Editar perfil" onPress={() => router.push('/perfil/editar')} />
        </View>

        <View style={{ gap: spacing.sm }}>
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
            icon={<Feather name="bell" size={layout.menuRowIcon} color={colors.white} />}
            label="Preferências de notificação"
            onPress={() => router.push('/perfil/notificacoes')}
          />
          <MenuRow
            icon={<Feather name="trash-2" size={layout.menuRowIcon} color={colors.white} />}
            label="Apagar conta"
            onPress={() => router.push('/apagar-conta')}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}
