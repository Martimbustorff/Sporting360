// Figma V7.1: 12 GameBox · Modo bilhete (4936:7161). Cartão branco (raio 20): faixa primary com emblema, jogo e data,
// QR de 220 com "Mostra este código na porta", picotado e Porta/Sector/Fila/Lugar; por baixo nome e número de sócio e o
// aviso do brilho. O QR do Figma é ilustrativo: aqui é o número da GameBox (react-native-qrcode-svg), nunca em logs.
// Enquanto o ecrã tem o foco: brilho no máximo (valor anterior reposto ao sair e em segundo plano), ecrã sempre ligado e
// vertical (lib/ticketMode). Lugar: Estádio no futebol, Pavilhão nas outras modalidades (lib/gamebox.ticketVenue).
// Jogo seguinte: o primeiro por abrir da Home (useHomeMatches). SEM FIGMA: sem jogo a faixa mostra o nome da GameBox e o
// recinto; "Esta GameBox já não existe." e o erro de leitura reusam os textos do formulário.
// Rota `/gamebox/bilhete?id={id}`: `principal` é a GameBox antiga do perfil da V2 (mesma regra da folha da Home).
import { useMemo } from 'react';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScrollView, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { EmptyState } from '@/components/EmptyState';
import { CARD_TEXT } from '@/components/GameboxCard';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { useNow } from '@/data/clock';
import { useMyUser } from '@/data/hooks';
import { useHomeMatches } from '@/data/sports';
import { useMyGameboxes } from '@/data/user';
import type { Match } from '@/data/schemas';
import {
  fromGameboxDoc,
  gameboxLabel,
  normalizeGameboxNumber,
  resolveGameboxList,
  ticketSeat,
  ticketVenue,
  VENUE_NAMES,
  type GameboxView,
  type Seat,
} from '@/lib/gamebox';
import { formatCardDate, formatTime } from '@/lib/ptDate';
import { useTicketMode } from '@/lib/ticketMode';
import { useSession } from '@/providers/SessionProvider';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CREST = require('../../../assets/images/sporting-cp-2026.png');

export const TICKET_TEXT = {
  title: 'Gamebox',
  hint: 'Mostra este código na porta',
  brightness: 'Brilho no máximo enquanto este ecrã está aberto',
  memberPrefix: 'Sócio n.º',
  notFound: 'Esta GameBox já não existe.',
  loadError: 'Não foi possível carregar as tuas GameBox.',
  stadium: 'Estádio',
  pavilion: 'Pavilhão',
  venueShort: { stadium: 'Alvalade', pavilion: 'João Rocha' },
} as const;

const COLUMNS: { key: keyof Seat; label: string }[] = [
  { key: 'port', label: 'Porta' },
  { key: 'sector', label: 'Sector' },
  { key: 'line', label: 'Fila' },
  { key: 'seat', label: 'Lugar' },
];

const sentence = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s);

const GRACE_MS = 4 * 3_600_000; // como a Home: um jogo por abrir há mais de 4 h deixa de contar

/** O primeiro jogo ainda por jogar (ao vivo, ou NS/PST sem passar a folga); os terminados saltam para o seguinte. */
function upcoming(matches: readonly Match[], now: Date): Match | null {
  return (
    [...matches]
      .sort((x, y) => x.kickoff.getTime() - y.kickoff.getTime())
      .find((m) => m.status === 'LIVE' || m.status === 'HT' || ((m.status === 'NS' || m.status === 'PST') && m.kickoff.getTime() >= now.getTime() - GRACE_MS)) ??
    null
  );
}

function Band({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View
      style={{
        backgroundColor: colors.primary,
        flexDirection: 'row',
        alignItems: 'center',
        gap: layout.ticketBandGap,
        paddingHorizontal: layout.ticketBandPadX,
        paddingVertical: layout.ticketBandPadY,
      }}
    >
      <View
        style={{
          width: layout.ticketCrest,
          height: layout.ticketCrest,
          borderRadius: layout.ticketCrest / 2,
          backgroundColor: colors.white,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image source={CREST} contentFit="contain" accessible={false} style={layout.ticketCrestImage} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text71 variant="label16" numberOfLines={1} ellipsizeMode="tail">{title}</Text71>
        <Text71 variant="caption12" numberOfLines={1} ellipsizeMode="tail">{subtitle}</Text71>
      </View>
    </View>
  );
}

function Perforation() {
  // Só a linha de cima de uma caixa tracejada: o contentor de 1.5 pt corta o resto.
  return (
    <View style={{ height: layout.ticketPerforation, overflow: 'hidden' }}>
      <View
        style={{
          height: layout.ticketPerforation * 4,
          borderWidth: layout.ticketPerforation,
          borderStyle: 'dashed',
          borderColor: colors.inkSeparator,
        }}
      />
    </View>
  );
}

function Ticket({ gamebox, index, match }: { gamebox: GameboxView; index: number; match: Match | null }) {
  const number = normalizeGameboxNumber(gamebox.number);
  const venue = ticketVenue(match?.sport);
  const seat = ticketSeat(gamebox, venue);
  const venueName = TICKET_TEXT.venueShort[venue];
  const title = match ? `${match.home.name} - ${match.away.name}` : gameboxLabel(gamebox.name, index);
  const subtitle = match
    ? `${sentence(formatCardDate(match.kickoff))} · ${formatTime(match.kickoff)} · ${venueName}`
    : `${venue === 'stadium' ? TICKET_TEXT.stadium : TICKET_TEXT.pavilion} ${VENUE_NAMES[venue]}`;
  return (
    <View style={{ backgroundColor: colors.white, borderRadius: layout.ticketRadius, overflow: 'hidden' }}>
      <Band title={title} subtitle={subtitle} />
      <View
        style={{
          alignItems: 'center',
          gap: layout.ticketQrGap,
          paddingTop: layout.ticketQrPadTop,
          paddingBottom: layout.ticketQrPadBottom,
          paddingHorizontal: layout.ticketBandPadX,
        }}
      >
        {number ? (
          <>
            <QRCode value={number} size={layout.ticketQr} color={colors.ink} backgroundColor={colors.white} quietZone={0} />
            <Text71 variant="caption12" color="inkMuted">{TICKET_TEXT.hint}</Text71>
          </>
        ) : (
          <Text71 variant="caption12" color="inkMuted" style={{ textAlign: 'center' }}>{CARD_TEXT.unreadable}</Text71>
        )}
      </View>
      <Perforation />
      <View
        accessible
        accessibilityLabel={`${venueName}: ${COLUMNS.map((c) => `${c.label} ${seat[c.key] || '-'}`).join(', ')}`}
        style={{
          flexDirection: 'row',
          gap: layout.ticketSeatGap,
          paddingHorizontal: layout.ticketSeatPadX,
          paddingTop: layout.ticketSeatPadTop,
          paddingBottom: layout.ticketSeatPadBottom,
        }}
      >
        {COLUMNS.map((c) => (
          <View key={c.key} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: layout.gameboxTextGap }}>
            <Text71 variant="badge11" color="inkMuted" numberOfLines={1}>{c.label}</Text71>
            <Text71 variant="title24" color="ink" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={layout.ticketSeatMinScale}>
              {seat[c.key] || '-'}
            </Text71>
          </View>
        ))}
      </View>
    </View>
  );
}

function Body({ gamebox, index }: { gamebox: GameboxView; index: number }) {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const user = useMyUser(uid);
  const now = useNow(60_000);
  const matches = useHomeMatches(now);
  const match = useMemo(() => (matches.status === 'ready' ? upcoming(matches.data, now) : null), [matches, now]);
  const data = user.status === 'ready' ? user.data : null;
  const rawName = (data?.name ?? '').trim();
  const name = rawName.includes('@') ? '' : rawName;
  const member = (data?.memberNumber ?? '').trim();
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: space.s24,
        paddingTop: layout.ticketTop,
        paddingBottom: space.s24,
        gap: layout.ticketBlockGap,
      }}
    >
      <Ticket gamebox={gamebox} index={index} match={match} />
      {name || member ? (
        <View style={{ alignItems: 'center', gap: layout.gameboxTextGap }}>
          {name ? <Text71 variant="label16" numberOfLines={1} ellipsizeMode="tail">{name}</Text71> : null}
          {member ? (
            <Text71 variant="caption12" color="textMuted" numberOfLines={1}>{`${TICKET_TEXT.memberPrefix} ${member}`}</Text71>
          ) : null}
        </View>
      ) : null}
      <View
        style={{
          alignSelf: 'center',
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.s8,
          backgroundColor: colors.surface06,
          borderRadius: radii.r16,
          paddingHorizontal: space.s12,
          paddingVertical: space.s8,
        }}
      >
        <Feather name="sun" size={16} color={colors.primaryOnDark} accessibilityElementsHidden importantForAccessibility="no" />
        <Text71 variant="caption12" color="textMuted" style={{ flexShrink: 1 }}>{TICKET_TEXT.brightness}</Text71>
      </View>
    </ScrollView>
  );
}

export default function GameboxBilhete() {
  useTicketMode();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const boxes = useMyGameboxes(uid);
  const user = useMyUser(uid);
  const state = resolveGameboxList(boxes, user, uid);

  let content;
  if (state.status === 'error') {
    content = <EmptyState icon="info" text={TICKET_TEXT.loadError} />;
  } else if (state.status === 'loading' || !uid) {
    content = <View testID="gamebox-bilhete-loading" style={{ flex: 1 }} />;
  } else {
    const views: GameboxView[] = state.legacy
      ? [{ ...state.legacy, id: 'principal', order: 0 }]
      : state.list.map((d) => fromGameboxDoc(d, uid));
    const index = views.findIndex((g) => g.id === id);
    const found = views[index];
    content = found ? <Body gamebox={found} index={index} /> : <EmptyState icon="info" text={TICKET_TEXT.notFound} />;
  }
  return (
    <Screen padded="none">
      <Header title={TICKET_TEXT.title} onBack={back} />
      {content}
    </Screen>
  );
}
