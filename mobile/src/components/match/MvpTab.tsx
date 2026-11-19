// SEM FIGMA: tab MVP sem frame vetorial; referência na imagem raster da página "Appstore S360" (Mapa do Figma do
// Plano 4: "Vídeos, Prognóstico, MVP, cartão S360 MATCHDAY", nó 818:21193, visto com get_screenshot). Composto com
// tokens: lista de candidatos em linhas com contorno e cantos arredondados, a escolhida preenchida a primary com o
// visto. As percentagens da referência aparecem depois de votar ou quando a votação fecha (antes disso puxariam o voto
// para o mais votado e o voto é definitivo): linha só de leitura com a percentagem à direita (estilo secundário) e
// "{n} votos" por baixo (mvpTallies, escrito pelo servidor ao minuto, pode atrasar-se). Confirmação numa folha
// inferior em Modal, FormMessage para erros e OfflineBanner, como na tab Prognóstico. Sem fotografias.
// Regras (spec §6): abre ao minuto 80, fecha 20 minutos depois do apito final; um voto definitivo, só pela callable
// voteMvp (services/game.ts); candidatos e janela iguais ao servidor (lib/gameWindows: mvpCandidates, mvpWindow), mas
// só desenham a UI: o servidor decide e os seus códigos de erro dão as mensagens. Adiado e cancelado não abrem.
import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormMessage } from '@/components/AuthForm';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Touchable } from '@/components/Touchable';
import type { Match, MvpTally, PlayersDoc, PointEvent } from '@/data/schemas';
import { useMatchDetail, useMvpTally } from '@/data/sports';
import { useMyGamePoints, useMyMvpVote, useSettlement } from '@/data/user';
import {
  clockText,
  GameActionError,
  MVP_CLOSE_AFTER_MS,
  MVP_OPEN_ELAPSED,
  mvpCandidates,
  mvpWindow,
  type GameActionCode,
  type MvpCandidate,
} from '@/lib/gameWindows';
import { mvpPercentages } from '@/lib/mvpPercent';
import { useSession } from '@/providers/SessionProvider';
import { voteMvp } from '@/services/game';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing, type } from '@/theme/tokens';
import { useMatchScroll } from '@/components/match/MatchScroll';

export const MVP_TEXT = {
  opensAt: `A votação abre ao minuto ${MVP_OPEN_ELAPSED}.`,
  closesLive: 'Fecha 20 minutos depois do apito final.',
  noCandidates: 'Os candidatos aparecem quando houver dados do jogo.',
  closed: 'A votação já fechou.',
  settling: 'A apurar o MVP oficial.',
  noOfficial: 'Sem MVP oficial neste jogo.',
  officialUnknown: 'MVP oficial apurado.',
  voteRecorded: 'O teu voto foi registado.',
  alreadyVoted: 'Já votaste neste jogo.',
  postponed: 'Sem votação: jogo adiado.',
  cancelled: 'Sem votação: jogo cancelado.',
  error: 'Não foi possível carregar os dados.',
  signedOut: 'Entra na tua conta para votares no MVP.',
  confirmTitle: 'Confirmar voto',
} as const;

export const MVP_ERRORS: Record<GameActionCode, string> = {
  CLOSED: MVP_TEXT.closed,
  NOT_OPEN: 'A votação ainda não abriu. Tenta daqui a pouco.',
  ALREADY: MVP_TEXT.alreadyVoted,
  INVALID: 'Este jogador não está entre os candidatos. Escolhe outro.',
  OFFLINE: 'Sem ligação. O teu voto não foi enviado; tenta outra vez.',
  UNAUTHENTICATED: 'A sessão terminou. Entra outra vez para votares.',
  UNKNOWN: 'Não foi possível enviar o voto. Tenta outra vez.',
};

const FINISHED: ReadonlyArray<Match['status']> = ['FT', 'AET', 'PEN'];
const TICK_MS = 1_000;

const votesText = (n: number) => `${n} ${n === 1 ? 'voto' : 'votos'}`;

const pointsText = (n: number) => `+${n} ${n === 1 ? 'ponto' : 'pontos'}`;

/** "A", "A e B", "A, B e C". */
function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`;
}

/** Nome de um jogador em qualquer equipa do documento `players` (o voto e o MVP oficial são ids). */
function nameOf(doc: PlayersDoc | null, playerId: string): string | null {
  for (const t of doc?.teams ?? []) {
    const p = t.players.find((x) => String(x.playerId) === playerId);
    if (p) return p.name;
  }
  return null;
}

/** Só os pontos do acerto no MVP (a participação e o prognóstico do mesmo jogo ficam de fora). */
function mvpCorrectPoints(events: PointEvent[]): number {
  return events.filter((e) => e.type === 'mvp_correct').reduce((sum, e) => sum + e.points, 0);
}

/**
 * Relógio a cada segundo enquanto a janela do voto está aberta depois do apito final (contagem "Fecha em mm:ss" e fecho
 * sozinho). `untilMs` é o fecho; o intervalo pára nesse instante, e não arranca se `stop` (resultado apurado ou
 * servidor já disse que fechou) ou se o fecho já passou: nunca fica um intervalo a correr sem efeito.
 */
function useMvpClock(untilMs: number | null, stop: boolean): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    setNow(new Date());
    if (untilMs === null || stop || Date.now() >= untilMs) return undefined;
    const interval = setInterval(() => {
      const next = new Date();
      setNow(next);
      if (next.getTime() >= untilMs) clearInterval(interval);
    }, TICK_MS);
    return () => clearInterval(interval);
  }, [untilMs, stop]);
  return now;
}

function Info({ text }: { text: string }) {
  return (
    <Body variant="body" style={{ textAlign: 'center', color: colors.textMuted }}>
      {text}
    </Body>
  );
}

function CandidateRow({ candidate, selected, onPress }: { candidate: MvpCandidate; selected: boolean; onPress: () => void }) {
  return (
    <Touchable
      testID={`mvp-candidate-${candidate.playerId}`}
      accessibilityRole="button"
      accessibilityLabel={`Votar em ${candidate.name}`}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: layout.mvpRowHeight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: layout.separator,
        borderColor: selected ? colors.primary : colors.textDisabled,
        backgroundColor: selected ? colors.primary : undefined,
      }}
    >
      <Body variant="body" numberOfLines={1} style={{ flex: 1 }}>
        {candidate.name}
      </Body>
      {selected ? <Feather name="check-circle" size={layout.eventGlyph} color={colors.white} /> : null}
    </Touchable>
  );
}

/** Linha só de leitura: nome à esquerda, percentagem à direita (estilo secundário). O voto do próprio fica a primary. */
function ResultRow({ candidate, percent, mine }: { candidate: MvpCandidate; percent: number; mine: boolean }) {
  return (
    <View
      testID={`mvp-result-${candidate.playerId}`}
      style={{
        minHeight: layout.mvpRowHeight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.md,
        borderWidth: layout.separator,
        borderColor: mine ? colors.primary : colors.textDisabled,
        backgroundColor: mine ? colors.primary : undefined,
      }}
    >
      <Body variant="body" numberOfLines={1} style={{ flex: 1 }}>
        {candidate.name}
      </Body>
      <Text style={[type.newsMeta, { textAlign: 'right' }, mine ? { color: colors.white } : null]}>{`${percent}%`}</Text>
    </View>
  );
}

function Results({ candidates, tally, mineId }: { candidates: MvpCandidate[]; tally: MvpTally; mineId: string | null }) {
  const percent = mvpPercentages(
    tally,
    candidates.map((c) => c.playerId),
  );
  return (
    <View style={{ gap: spacing.sm }}>
      {candidates.map((c) => (
        <ResultRow key={c.playerId} candidate={c} percent={percent[c.playerId] ?? 0} mine={c.playerId === mineId} />
      ))}
      <Text style={[type.newsMeta, { textAlign: 'center' }]}>{votesText(tally.total)}</Text>
    </View>
  );
}

function ConfirmSheet({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onCancel}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: layout.lockScrim }}>
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: colors.bg,
            borderTopLeftRadius: radius.sheet,
            borderTopRightRadius: radius.sheet,
            padding: layout.lockModalPad,
            paddingBottom: Math.max(bottom, layout.homeIndicator) + layout.lockBottom,
            gap: layout.lockModalGap,
          }}
        >
          <Text style={type.screenTitle} accessibilityRole="header">
            {MVP_TEXT.confirmTitle}
          </Text>
          <Body variant="body">{`Votar em ${name}? É definitivo.`}</Body>
          <PrimaryButton label="Confirmar" onPress={onConfirm} />
          <PrimaryButton label="Cancelar" variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

function VoteForm({
  match,
  candidates,
  onSent,
  onClosed,
  onAlready,
}: {
  match: Match;
  candidates: MvpCandidate[];
  onSent: (playerId: string) => void;
  onClosed: () => void;
  onAlready: () => void;
}) {
  // A escolha fica aqui enquanto a lista existe: um erro (sem rede, etc.) não a apaga.
  const [selected, setSelected] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Um toque duplo em "Confirmar" antes do novo render não chama a callable duas vezes.
  const busy = useRef(false);

  const chosen = candidates.find((c) => c.playerId === selected) ?? null;

  const send = async (playerId: string) => {
    if (busy.current) return;
    busy.current = true;
    setConfirming(false);
    setSending(true);
    setError(null);
    try {
      await voteMvp(match.id, playerId);
      // O snapshot de mvpVotes chega a seguir; até lá mostra-se o voto enviado.
      onSent(playerId);
    } catch (e) {
      const code = e instanceof GameActionError ? e.code : 'UNKNOWN';
      if (code === 'CLOSED') {
        onClosed();
        return;
      }
      // Já tinha votado (por exemplo, a primeira tentativa gravou mas a resposta perdeu-se): não é um erro.
      if (code === 'ALREADY') {
        onAlready();
        return;
      }
      setError(MVP_ERRORS[code]);
    } finally {
      busy.current = false;
      setSending(false);
    }
  };

  return (
    <View style={{ gap: spacing.sm }}>
      {candidates.map((c) => (
        <CandidateRow
          key={c.playerId}
          candidate={c}
          selected={c.playerId === selected}
          onPress={() => {
            if (sending) return;
            setSelected(c.playerId);
            setError(null);
            setConfirming(true);
          }}
        />
      ))}
      {error ? <FormMessage text={error} /> : null}
      {confirming && chosen ? (
        <ConfirmSheet name={chosen.name} onConfirm={() => void send(chosen.playerId)} onCancel={() => setConfirming(false)} />
      ) : null}
    </View>
  );
}

function Settled({ doc, official, points }: { doc: PlayersDoc | null; official: string[]; points: number | null }) {
  const names = official.map((id) => nameOf(doc, id)).filter((n): n is string => n !== null);
  let text: string;
  if (official.length === 0) text = MVP_TEXT.noOfficial;
  else if (names.length === 0) text = MVP_TEXT.officialUnknown;
  else text = `MVP oficial: ${joinNames(names)}`;
  return (
    <View style={{ gap: spacing.sm, alignItems: 'center' }}>
      <Display variant="sectionScore" style={{ textAlign: 'center' }}>
        {text}
      </Display>
      {points !== null && points > 0 ? (
        <Display variant="screenTitle" style={{ textAlign: 'center' }}>
          {pointsText(points)}
        </Display>
      ) : null}
    </View>
  );
}

export function MvpTab({ match }: { match: Match }) {
  const scrollProps = useMatchScroll();
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const vote = useMyMvpVote(match.id, uid);
  const players = useMatchDetail(match.id, 'players');
  const settlement = useSettlement(match.id);
  const points = useMyGamePoints(match.id, uid);

  const finishedAtMs = match.finishedAt?.getTime() ?? null;

  // O servidor disse que fechou (relógio do telemóvel adiantado). Esquece-se quando o jogo muda de estado.
  const [serverClosed, setServerClosed] = useState(false);
  const closesAtMs = FINISHED.includes(match.status) && finishedAtMs !== null ? finishedAtMs + MVP_CLOSE_AFTER_MS : null;
  const now = useMvpClock(closesAtMs, serverClosed || settlement.status === 'ready');
  const [sent, setSent] = useState<string | null>(null);
  // O servidor disse "já votaste" mas o snapshot do voto ainda não chegou.
  const [alreadyVoted, setAlreadyVoted] = useState(false);
  useEffect(() => {
    setServerClosed(false);
  }, [match.status, finishedAtMs]);

  // As percentagens só se mostram depois de votar ou de a votação fechar: antes disso nem se lê o documento.
  const hasVoted = (vote.status === 'ready' && vote.data.playerId !== null) || sent !== null || alreadyVoted;
  const closedNow = serverClosed || mvpWindow(match, now).state === 'closed' || settlement.status === 'ready';
  const showPercent = match.status !== 'PST' && match.status !== 'CANC' && uid !== null && (hasVoted || closedNow);
  const tally = useMvpTally(showPercent ? match.id : null);

  if (match.status === 'CANC') return <EmptyState icon="info" text={MVP_TEXT.cancelled} />;
  if (match.status === 'PST') return <EmptyState icon="info" text={MVP_TEXT.postponed} />;
  if (session.status === 'signedOut') return <EmptyState icon="info" text={MVP_TEXT.signedOut} />;
  if (vote.status === 'loading') return <View testID="mvp-loading" />;
  if (vote.status === 'error') return <EmptyState icon="info" text={MVP_TEXT.error} />;

  const doc = players.status === 'ready' ? players.data : null;
  const win = mvpWindow(match, now);
  const state = serverClosed ? 'closed' : win.state;
  const voted = vote.status === 'ready' ? vote.data.playerId : sent;
  const settled = settlement.status === 'ready' ? settlement.data : null;
  const offline = (vote.status === 'ready' && vote.fromCache === true) || (players.status === 'ready' && players.fromCache === true);

  const parts: React.JSX.Element[] = [];
  const tallyData = showPercent && tally.status === 'ready' && tally.data.total > 0 ? tally.data : null;
  if (voted !== null) {
    const name = nameOf(doc, voted);
    parts.push(
      <Display key="vote" variant="sectionScore" style={{ textAlign: 'center' }}>
        {name ? `O teu voto: ${name}` : MVP_TEXT.voteRecorded}
      </Display>,
    );
  } else if (alreadyVoted) {
    parts.push(<Info key="already" text={MVP_TEXT.alreadyVoted} />);
  } else if (state === 'closed') {
    parts.push(<Info key="closed" text={MVP_TEXT.closed} />);
  } else if (state === 'before') {
    parts.push(<Info key="opens" text={MVP_TEXT.opensAt} />);
    if (match.status === 'LIVE' && match.elapsed !== null && match.elapsed < MVP_OPEN_ELAPSED) {
      parts.push(<Info key="left" text={`Faltam cerca de ${MVP_OPEN_ELAPSED - match.elapsed} min.`} />);
    }
  } else {
    const candidates = mvpCandidates(doc);
    if (players.status === 'loading') parts.push(<View key="players-loading" testID="mvp-players-loading" />);
    // Leitura falhada: erro, nunca a mensagem de "ainda sem candidatos".
    else if (players.status === 'error') parts.push(<EmptyState key="players-error" icon="info" text={MVP_TEXT.error} />);
    else if (candidates.length === 0) parts.push(<EmptyState key="empty" icon="info" text={MVP_TEXT.noCandidates} />);
    else parts.push(<VoteForm key="form" match={match} candidates={candidates} onSent={setSent} onClosed={() => setServerClosed(true)} onAlready={() => setAlreadyVoted(true)} />);
  }

  // Votou ou fechou: lista de leitura com as percentagens (sem tally, sem votos ou erro de leitura: nada).
  if (tallyData && (voted !== null || state === 'closed' || alreadyVoted || settled !== null)) {
    const list = mvpCandidates(doc);
    if (list.length > 0) parts.push(<Results key="results" candidates={list} tally={tallyData} mineId={voted} />);
  }

  if (state === 'open') {
    parts.push(
      <Body key="closes" variant="strip" style={{ textAlign: 'center' }}>
        {win.closesAt ? `Fecha em ${clockText(win.closesAt.getTime() - now.getTime())}` : MVP_TEXT.closesLive}
      </Body>,
    );
  }

  if (settled) {
    parts.push(
      <Settled
        key="settled"
        doc={doc}
        official={settled.officialMvp}
        points={voted !== null && points.status === 'ready' ? mvpCorrectPoints(points.data) : null}
      />,
    );
  } else if (state === 'closed') {
    parts.push(<Info key="settling" text={MVP_TEXT.settling} />);
  }

  return (
    <ScrollView
      {...scrollProps}
      testID="mvp-tab"
      contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      <OfflineBanner visible={offline} />
      {parts}
    </ScrollView>
  );
}
