// Figma V7.1: 12 GameBox · Modo bilhete (4936:7161). Cartão branco (raio 20): faixa primary com emblema, jogo e data,
// QR de 220 com "Mostra este código na porta", picotado e Porta/Sector/Fila/Lugar; por baixo nome e número de sócio e o
// aviso do brilho. O QR do Figma é ilustrativo: aqui é o número da GameBox (react-native-qrcode-svg), nunca em logs.
// Enquanto o ecrã tem o foco E o QR está desenhado E o BiometricGate não está por cima: brilho no máximo (valor anterior
// reposto ao sair e em segundo plano), ecrã sempre ligado e vertical (lib/ticketMode). Faixa com o nome curto do clube (4936:7207). Lugar: Estádio no futebol, Pavilhão nas outras modalidades (lib/gamebox.ticketVenue).
// Jogo seguinte: o primeiro jogo EM CASA do Sporting por abrir, em todas as modalidades (useUpcomingMatches por
// modalidade); fora de casa não conta. SEM FIGMA: sem jogo a faixa mostra só o nome da GameBox; "Esta GameBox já não existe." e o erro de leitura reusam os textos do formulário.
// Várias GameBox (ex.: um pai com três filhos a passar o torniquete com o mesmo telemóvel): deslizar na horizontal entre
// bilhetes, pela ordem guardada, a abrir na do `id`; pontos de página por baixo (acrescentado a pedido do Martim, o frame 12
// não os tem). Uma só GameBox: sem pontos nem paginação.
// Rota `/gamebox/bilhete?id={id}`: `principal` é a GameBox antiga do perfil da V2 (mesma regra da folha da Home).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, ScrollView, View, useWindowDimensions, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { EmptyState } from '@/components/EmptyState';
import { CARD_TEXT } from '@/components/GameboxCard';
import { Header } from '@/components/Header';
import { CancelLoanSheet, LOAN_TEXT } from '@/components/LoanConfirmSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { useNow } from '@/data/clock';
import { useMyUser } from '@/data/hooks';
import { useOwnerLoans } from '@/data/loans';
import { useUpcomingMatches } from '@/data/sports';
import { useMyGameboxes } from '@/data/user';
import { SportSchema, type Match, type Sport } from '@/data/schemas';
import {
  fromGameboxDoc,
  gameboxLabel,
  normalizeGameboxNumber,
  resolveGameboxList,
  ticketSeat,
  ticketVenue,
  upcomingHome,
  type GameboxView,
  type Seat,
} from '@/lib/gamebox';
import { formatCardDate, formatTime } from '@/lib/ptDate';
import { useTicketMode } from '@/lib/ticketMode';
import { shortClubName } from '@/lib/teams';
import { useGateCovered } from '@/providers/gateCover';
import { useSession } from '@/providers/SessionProvider';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

const CREST = require('../../../assets/images/sporting-cp-2026.png');

export const TICKET_TEXT = {
  title: 'GameBox',
  hint: 'Mostra este código na porta',
  brightness: 'Brilho no máximo enquanto este ecrã está aberto',
  memberPrefix: 'Sócio n.º',
  notFound: 'Esta GameBox já não existe.',
  next: 'Seguinte',
  previous: 'Anterior',
  loadError: 'Não foi possível carregar as tuas GameBox.',
  venueShort: { stadium: 'Alvalade', pavilion: 'João Rocha' },
} as const;

const COLUMNS: { key: keyof Seat; label: string }[] = [
  { key: 'port', label: 'Porta' },
  { key: 'sector', label: 'Sector' },
  { key: 'line', label: 'Fila' },
  { key: 'seat', label: 'Lugar' },
];

const sentence = (s: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s);

const SPORTS: readonly Sport[] = SportSchema.options;

function Band({ title, subtitle }: { title: string; subtitle: string | null }) {
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
        {subtitle ? <Text71 variant="caption12" numberOfLines={1} ellipsizeMode="tail">{subtitle}</Text71> : null}
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

function Ticket({ gamebox, index, match, lent, loading }: { gamebox: GameboxView; index: number; match: Match | null; lent: boolean; loading: boolean }) {
  const number = normalizeGameboxNumber(gamebox.number);
  const venue = ticketVenue(match?.sport);
  const seat = ticketSeat(gamebox, venue);
  const venueName = TICKET_TEXT.venueShort[venue];
  const title = match ? `${shortClubName(match.home.name)} - ${shortClubName(match.away.name)}` : gameboxLabel(gamebox.name, index);
  const subtitle = match
    ? `${sentence(formatCardDate(match.kickoff))} · ${formatTime(match.kickoff)} · ${venueName}`
    : null;
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
        {loading ? (
          // Estado do empréstimo por saber: nem QR nem aviso, só o espaço do código.
          <View testID="ticket-loan-loading" style={{ width: layout.ticketQr, height: layout.ticketQr }} />
        ) : lent ? (
          // 12L (4984:12044): emprestada para este jogo, o código não se mostra.
          <View style={{ alignItems: 'center', gap: layout.loanStateGap, paddingVertical: space.s8 }}>
            <Text71 variant="title24" color="ink" style={{ textAlign: 'center' }}>{LOAN_TEXT.lentForThisGame}</Text71>
            <Text71 variant="caption12" color="inkMuted" style={{ textAlign: 'center' }}>{LOAN_TEXT.lentForThisGameHint}</Text71>
          </View>
        ) : number ? (
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

function Page({
  gamebox,
  index,
  match,
  name,
  member,
  onQrShown,
  settled,
}: {
  gamebox: GameboxView;
  index: number;
  match: Match | null;
  name: string;
  member: string;
  /** Diz ao ecrã se o QR desta página está a ser desenhado (nem a carregar o empréstimo, nem emprestada, nem sem número). */
  onQrShown: (id: string, shown: boolean) => void;
  /** Falso enquanto as listas de jogos carregam: ainda não se sabe se a GameBox está emprestada para o próximo jogo. */
  settled: boolean;
}) {
  // Cada página é a sua GameBox: o estado "emprestada" aplica-se quando ela tem um empréstimo ativo para o jogo da faixa.
  const loans = useOwnerLoans(gamebox.id);
  const loan = match && loans.status === 'ready' ? loans.data.find((l) => l.matchId === match.id) : undefined;
  const [cancelling, setCancelling] = useState(false);
  const qrShown = settled && loans.status !== 'loading' && !loan && normalizeGameboxNumber(gamebox.number) !== null;
  const { id } = gamebox;
  useEffect(() => {
    onQrShown(id, qrShown);
    return () => onQrShown(id, false);
  }, [id, qrShown, onQrShown]);
  return (
    <ScrollView
      contentContainerStyle={{
        paddingHorizontal: space.s24,
        paddingTop: layout.ticketTop,
        paddingBottom: space.s24,
        gap: layout.ticketBlockGap,
      }}
    >
      <Ticket gamebox={gamebox} index={index} match={match} lent={!!loan} loading={!settled || loans.status === 'loading'} />
      {name || member ? (
        <View style={{ alignItems: 'center', gap: layout.gameboxTextGap }}>
          {name ? <Text71 variant="label16" numberOfLines={1} ellipsizeMode="tail">{name}</Text71> : null}
          {member ? (
            <Text71 variant="caption12" color="textMuted" numberOfLines={1}>{`${TICKET_TEXT.memberPrefix} ${member}`}</Text71>
          ) : null}
        </View>
      ) : null}
      {loan ? (
        <PrimaryButton label={LOAN_TEXT.cancel} variant="outline" onPress={() => setCancelling(true)} />
      ) : (
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
      )}
      {cancelling && loan ? <CancelLoanSheet loanId={loan.id} onClose={() => setCancelling(false)} /> : null}
    </ScrollView>
  );
}

/** Pontos de página; um só elemento de acessibilidade com "GameBox N de M, nome" e as ações seguinte e anterior. */
function PageDots({ index, count, label, onStep }: { index: number; count: number; label: string; onStep: (delta: 1 | -1) => void }) {
  return (
    <View
      testID="ticket-pager-control"
      accessible
      accessibilityLabel={label}
      accessibilityActions={[
        { name: 'next', label: TICKET_TEXT.next },
        { name: 'previous', label: TICKET_TEXT.previous },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'next') onStep(1);
        else if (e.nativeEvent.actionName === 'previous') onStep(-1);
      }}
      style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.s8, paddingTop: space.s8, paddingBottom: space.s16 }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          testID="ticket-dot"
          style={{
            width: space.s8,
            height: space.s8,
            borderRadius: space.s4,
            backgroundColor: i === index ? colors.white : colors.surface20,
          }}
        />
      ))}
    </View>
  );
}

function Body({ views, initialIndex }: { views: GameboxView[]; initialIndex: number }) {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const user = useMyUser(uid);
  const now = useNow(60_000);
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<GameboxView>>(null);
  const [current, setCurrent] = useState(initialIndex);
  // Um hook por modalidade (lista fixa, ordem estável); partilhado por todas as páginas.
  const lists = SPORTS.map((sport) => useUpcomingMatches(sport, now)); // eslint-disable-line react-hooks/rules-of-hooks
  // A faixa não pisca: enquanto alguma lista volta a carregar (a consulta muda de 10 em 10 minutos) fica o último jogo
  // conhecido; sem jogo em casa a faixa é só o nome da GameBox, sempre.
  const settled = lists.every((l) => l.status !== 'loading');
  const [lastMatch, setLastMatch] = useState<Match | null>(null);
  const computed = useMemo(
    () => upcomingHome(lists.flatMap((l) => (l.status === 'ready' ? l.data : [])), now),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [...lists, now],
  );
  // `known`: já houve uma resposta das listas. Só então o QR pode contar como mostrado (as consultas seguintes, de 10 em 10
  // minutos, mantêm o último jogo e não fazem o brilho descer e subir).
  const [known, setKnown] = useState(false);
  useEffect(() => {
    if (settled) {
      setLastMatch(computed);
      setKnown(true);
    }
  }, [settled, computed]);
  const match = settled ? computed : lastMatch;
  // Brilho no máximo e ecrã ligado só com o QR desenhado da GameBox à vista e sem o bloqueio por cima.
  const [shown, setShown] = useState<Record<string, boolean>>({});
  const onQrShown = useCallback((id: string, on: boolean) => setShown((s) => (s[id] === on ? s : { ...s, [id]: on })), []);
  const covered = useGateCovered();
  const data = user.status === 'ready' ? user.data : null;
  const rawName = (data?.name ?? '').trim();
  const name = rawName.includes('@') ? '' : rawName;
  const member = (data?.memberNumber ?? '').trim();
  const count = views.length;
  const index = Math.min(current, count - 1);
  // Com as listas a carregar ainda não se sabe se a GameBox está emprestada para o próximo jogo: o QR conta como não mostrado.
  useTicketMode(!covered && shown[views[index]!.id] === true);

  const goTo = useCallback(
    (next: number) => {
      if (next < 0 || next >= count) return;
      setCurrent(next);
      listRef.current?.scrollToIndex({ index: next, animated: true });
    },
    [count],
  );
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const page = Math.round(e.nativeEvent.contentOffset.x / (width || 1));
    if (page >= 0 && page < count) setCurrent(page);
  };

  if (count === 1) {
    return <Page gamebox={views[0]!} index={0} match={match} name={name} member={member} onQrShown={onQrShown} settled={known} />;
  }
  const active = views[index]!;
  return (
    <>
      <FlatList
        ref={listRef}
        testID="ticket-pager"
        data={views}
        keyExtractor={(g) => g.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        initialNumToRender={count}
        windowSize={count + 1}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        onMomentumScrollEnd={onEnd}
        renderItem={({ item, index: i }) => (
          <View
            style={{ width }}
            accessibilityElementsHidden={i !== index}
            importantForAccessibility={i === index ? 'auto' : 'no-hide-descendants'}
          >
            <Page gamebox={item} index={i} match={match} name={name} member={member} onQrShown={onQrShown} settled={known} />
          </View>
        )}
        style={{ flex: 1 }}
      />
      <PageDots
        index={index}
        count={count}
        label={`GameBox ${index + 1} de ${count}, ${gameboxLabel(active.name, index)}`}
        onStep={(d) => goTo(index + d)}
      />
    </>
  );
}

export default function GameboxBilhete() {
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
    content = found ? <Body views={views} initialIndex={index} /> : <EmptyState icon="info" text={TICKET_TEXT.notFound} />;
  }
  return (
    <Screen padded="none">
      <Header title={TICKET_TEXT.title} onBack={back} />
      {content}
    </Screen>
  );
}
