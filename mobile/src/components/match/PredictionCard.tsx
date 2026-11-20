// Figma V7.1: Prognóstico (4945:7833) e submetido com a folha de partilha (4946:7934). "Fecha em" com relógio, duas linhas de
// seletor (Stepper), cartão das regras com contorno ("PONTOS"), Primário "Submeter prognóstico" e "Só podes submeter uma
// vez."; submetido: "Já submeteste este prognóstico.", as linhas só com o valor e "Partilhar prognóstico" (Contorno).
// Regras (spec §6): uma submissão definitiva, só pela callable submitPrediction (services/game.ts); fecha ao apito
// inicial. A janela da app (lib/gameWindows.predictionOpen) só desenha a UI: o servidor decide e os seus códigos de
// erro dão as mensagens. Adiado (PST) fecha com explicação e reabre sozinho quando o jogo volta a NS.
// As folhas (confirmação e partilha) são a ModalSheet (bg-raised, raio 28, grabber ao centro, 4946:8195).
// A partilha abre o cartão "S360 MATCHDAY" (ShareCard) com "Partilhar" (Branco) e "Fechar" (Contorno).
// Martim 20/11: o prognóstico deixou de ter separador. É um cartão no topo do Sumário, só antes do apito inicial (jogo
// NS e relógio antes do kickoff); ao apito sai e o palpite e os pontos ficam no cabeçalho do jogo (PredictionSummary).
import { haptic } from '@/lib/haptics';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';
import { FormMessage } from '@/components/AuthForm';
import { EmptyState } from '@/components/EmptyState';
import { SectionBar } from '@/components/SectionBar';
import { ModalSheet } from '@/components/ModalSheet';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ShareCard } from '@/components/ShareCard';
import { Stepper } from '@/components/Stepper';
import { TeamCrest } from '@/components/GameHeader';
import type { Match } from '@/data/schemas';
import { useMyPrediction } from '@/data/user';
import { countdownText } from '@/lib/countdown';
import { GameActionError, isKnockoutGame, predictionOpen, type GameActionCode } from '@/lib/gameWindows';
import { useSession } from '@/providers/SessionProvider';
import { toGameHeaderVM } from '@/lib/matchVM';
import { reportCode } from '@/lib/report';
import { submitPrediction } from '@/services/game';
import { shareMatchday } from '@/services/share';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

export const PREDICTION_TEXT = {
  section: 'Prognóstico',
  rulesTitle: 'Pontos',
  once: 'Só podes submeter uma vez.',
  rules: '+1 por participares, +3 resultado exato, +1 vencedor ou empate certo',
  cupRule: 'Nos jogos a eliminar conta o resultado com prolongamento; penáltis contam como empate.',
  submit: 'Submeter prognóstico',
  closed: 'Os prognósticos fecharam ao apito inicial.',
  error: 'Não foi possível carregar os dados.',
  signedOut: 'Entra na tua conta para fazeres o prognóstico.',
  share: 'Partilhar prognóstico',
  shareSend: 'Partilhar',
  shareClose: 'Fechar',
  shareError: 'Não foi possível partilhar. Tenta outra vez.',
} as const;

export const PREDICTION_ERRORS: Record<GameActionCode, string> = {
  CLOSED: PREDICTION_TEXT.closed,
  NOT_OPEN: PREDICTION_TEXT.closed,
  ALREADY: 'Já submeteste este prognóstico.',
  INVALID: 'Resultado inválido. Escolhe entre 0 e 20 golos.',
  OFFLINE: 'Sem ligação. O teu prognóstico não foi enviado; tenta outra vez.',
  UNAUTHENTICATED: 'A sessão terminou. Entra outra vez para fazeres o prognóstico.',
  UNKNOWN: 'Não foi possível enviar o prognóstico. Tenta outra vez.',
};

/** A contagem atualiza a cada 30 s. */
const TICK_MS = 30_000;
const MAX_GOALS = 20;
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Relógio a cada 30 s e um disparo exato no `kickoff`, para o formulário fechar sozinho ao apito inicial. Depois do
 * `kickoff` o formulário já fechou: o intervalo pára (e nem chega a existir se o jogo já começou).
 */
function usePredictionClock(kickoff: Date): Date {
  const [now, setNow] = useState(() => new Date());
  const kickoffMs = kickoff.getTime();
  useEffect(() => {
    setNow(new Date());
    const left = kickoffMs - Date.now();
    if (left <= 0) return;
    const interval = setInterval(() => setNow(new Date()), TICK_MS);
    // setTimeout limita o atraso a 2^31-1 ms (~24,8 dias); acima disso dispararia logo. O intervalo de 30 s
    // continua a correr e, ao chegar o kickoff, o formulário fecha na mesma.
    const atKickoff =
      left > MAX_TIMEOUT_MS
        ? null
        : setTimeout(() => {
            clearInterval(interval);
            setNow(new Date());
          }, left);
    return () => {
      clearInterval(interval);
      if (atKickoff) clearTimeout(atKickoff);
    };
  }, [kickoffMs]);
  return now;
}

function StatusLine({ icon, text }: { icon: 'clock' | 'check-circle'; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.statusGap }}>
      <Feather name={icon} size={layout.statusIcon} color={colors.primaryOnDark} accessibilityElementsHidden importantForAccessibility="no" />
      <Text71 variant="captionStrong12" color="primaryOnDark">
        {text}
      </Text71>
    </View>
  );
}

function RulesCard({ knockout }: { knockout: boolean }) {
  return (
    <View
      style={{
        borderWidth: layout.separator,
        borderColor: colors.separator,
        borderRadius: layout.rulesRadius,
        paddingHorizontal: space.s16,
        paddingVertical: space.s12,
        gap: space.s4,
      }}
    >
      <Text71 variant="eyebrow13" color="textSubtle">
        {PREDICTION_TEXT.rulesTitle}
      </Text71>
      <Text71 variant="caption12" color="textMuted">
        {PREDICTION_TEXT.rules}
      </Text71>
      {knockout ? (
        <Text71 variant="caption12" color="textMuted">
          {PREDICTION_TEXT.cupRule}
        </Text71>
      ) : null}
    </View>
  );
}

function ConfirmSheet({
  home,
  away,
  onConfirm,
  onCancel,
}: {
  home: number;
  away: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ModalSheet grabber="center" onClose={onCancel}>
      <Text71 variant="title24" accessibilityRole="header">
        Confirmar prognóstico
      </Text71>
      <Text71 variant="body14" color="textMuted">{`É definitivo. Confirmas ${home}-${away}?`}</Text71>
      <View style={{ gap: space.s12 }}>
        <PrimaryButton label="Confirmar" onPress={onConfirm} />
        <PrimaryButton label="Cancelar" variant="outline" onPress={onCancel} />
      </View>
    </ModalSheet>
  );
}

/** Folha com o cartão "S360 MATCHDAY": captura e partilha (imagem + texto com link); fecha depois de partilhar. */
function ShareSheet({ match, home, away, onClose }: { match: Match; home: number; away: number; onClose: () => void }) {
  const card = useRef<ComponentRef<typeof View>>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cardHeight = useRef<number | undefined>(undefined);

  const share = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await shareMatchday(card, match, home, away, cardHeight.current);
      if (result === 'shared') onClose();
    } catch (e) {
      reportCode('SHARE_FAILED', e);
      setError(PREDICTION_TEXT.shareError);
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalSheet grabber="center" onClose={onClose}>
      {/* A área do cartão vai até `shareCardInset` da borda do ecrã (o padding da folha é maior); o cartão
          escala-se sozinho para caber nela (ShareCard.shareCardScale). */}
      <View style={{ alignItems: 'center', marginHorizontal: layout.shareCardInset - space.s24 }}>
        <ShareCard ref={card} match={match} home={home} away={away} onCardHeight={(h) => (cardHeight.current = h)} />
      </View>
      {error ? <FormMessage text={error} /> : null}
      <View style={{ gap: space.s12 }}>
        <PrimaryButton label={PREDICTION_TEXT.shareSend} variant="white" onPress={() => void share()} loading={sending} />
        <PrimaryButton label={PREDICTION_TEXT.shareClose} variant="outline" onPress={onClose} />
      </View>
    </ModalSheet>
  );
}

function SharePrediction({ match, home, away }: { match: Match; home: number; away: number }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <PrimaryButton label={PREDICTION_TEXT.share} variant="outline" onPress={() => setOpen(true)} />
      {open ? <ShareSheet match={match} home={home} away={away} onClose={() => setOpen(false)} /> : null}
    </View>
  );
}

function crestOf(team: ReturnType<typeof toGameHeaderVM>['home'], side: 'home' | 'away') {
  return <TeamCrest team={team} testID={`prediction-crest-${side}`} size="sm" />;
}

/** As duas linhas só de leitura (4946:8064), um único elemento acessível: "O teu prognóstico: 2-1". */
function MyPrediction({ match, home, away }: { match: Match; home: number; away: number }) {
  const vm = toGameHeaderVM(match);
  return (
    <View accessible accessibilityLabel={`O teu prognóstico: ${home}-${away}`} style={{ gap: space.s16 }}>
      <Stepper readOnly label={match.home.name} crest={crestOf(vm.home, 'home')} value={home} />
      <Stepper readOnly label={match.away.name} crest={crestOf(vm.away, 'away')} value={away} />
    </View>
  );
}

function SubmittedPrediction({ match, home, away }: { match: Match; home: number; away: number }) {
  return (
    <View style={{ gap: space.s16 }}>
      <StatusLine icon="check-circle" text={PREDICTION_ERRORS.ALREADY} />
      <MyPrediction match={match} home={home} away={away} />
      <RulesCard knockout={isKnockoutGame(match.competition)} />
      <SharePrediction match={match} home={home} away={away} />
    </View>
  );
}

function PredictionForm({ match, now, onClosed }: { match: Match; now: Date; onClosed: () => void }) {
  // Os valores escolhidos ficam aqui enquanto o formulário existe: um erro (sem rede, etc.) não os apaga.
  const [home, setHome] = useState(0);
  const [away, setAway] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<{ home: number; away: number } | null>(null);
  // Um toque duplo em "Confirmar" antes do novo render não chama a callable duas vezes.
  const busy = useRef(false);

  if (sent) return <SubmittedPrediction match={match} home={sent.home} away={sent.away} />;

  const send = async () => {
    if (busy.current) return;
    busy.current = true;
    setConfirming(false);
    setSending(true);
    setError(null);
    try {
      await submitPrediction(match.id, home, away);
      haptic.success();
      // O snapshot de matchPredictions chega a seguir; até lá mostra-se o que foi enviado.
      setSent({ home, away });
    } catch (e) {
      const code = e instanceof GameActionError ? e.code : 'UNKNOWN';
      if (code === 'CLOSED') {
        onClosed();
        return;
      }
      setError(PREDICTION_ERRORS[code]);
    } finally {
      busy.current = false;
      setSending(false);
    }
  };

  const vm = toGameHeaderVM(match);
  return (
    <View style={{ gap: space.s16 }}>
      <StatusLine icon="clock" text={`Fecha em ${countdownText(match.kickoff.getTime() - now.getTime())}`} />
      <Stepper
        label={match.home.name}
        crest={crestOf(vm.home, 'home')}
        value={home}
        onChange={(n) => {
          setHome(n);
          setError(null);
        }}
        min={0}
        max={MAX_GOALS}
      />
      <Stepper
        label={match.away.name}
        crest={crestOf(vm.away, 'away')}
        value={away}
        onChange={(n) => {
          setAway(n);
          setError(null);
        }}
        min={0}
        max={MAX_GOALS}
      />
      <RulesCard knockout={isKnockoutGame(match.competition)} />
      {error ? <FormMessage text={error} /> : null}
      <PrimaryButton label={PREDICTION_TEXT.submit} onPress={() => setConfirming(true)} loading={sending} />
      <Text71 variant="caption12" color="textSubtle">
        {PREDICTION_TEXT.once}
      </Text71>
      {confirming ? (
        <ConfirmSheet home={home} away={away} onConfirm={() => void send()} onCancel={() => setConfirming(false)} />
      ) : null}
    </View>
  );
}

/**
 * Cartão do prognóstico no topo do Sumário. Só existe antes do apito inicial: jogo NS e relógio antes do `kickoff`
 * (fecha sozinho ao kickoff, sem esperar pelo estado da API). Adiado, cancelado, ao vivo ou terminado: nada.
 */
export function PredictionCard({ match }: { match: Match }) {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const prediction = useMyPrediction(match.id, uid);
  const now = usePredictionClock(match.kickoff);

  // O servidor disse que fechou (relógio do telemóvel atrasado). Esquece-se quando o jogo muda de estado ou de data
  // (adiado que volta a NS), para o formulário poder reabrir.
  const [serverClosed, setServerClosed] = useState(false);
  const kickoffMs = match.kickoff.getTime();
  useEffect(() => {
    setServerClosed(false);
  }, [match.status, kickoffMs]);

  if (!predictionOpen(match, now)) return null;

  let body: React.JSX.Element;
  if (session.status === 'signedOut') body = <EmptyState icon="info" text={PREDICTION_TEXT.signedOut} compact />;
  else if (prediction.status === 'loading') body = <View testID="prediction-loading" />;
  else if (prediction.status === 'error') body = <EmptyState icon="info" text={PREDICTION_TEXT.error} compact />;
  else if (prediction.status === 'ready') body = <SubmittedPrediction match={match} home={prediction.data.home} away={prediction.data.away} />;
  else if (serverClosed) body = <EmptyState icon="info" text={PREDICTION_TEXT.closed} compact />;
  // `key`: um jogo adiado que volta com nova data começa de novo em 0-0.
  else body = <PredictionForm key={kickoffMs} match={match} now={now} onClosed={() => setServerClosed(true)} />;

  const offline = prediction.status === 'ready' && prediction.fromCache === true;
  return (
    <View testID="prediction-card" style={{ gap: space.s16 }}>
      <SectionBar label={PREDICTION_TEXT.section} />
      <OfflineBanner visible={offline} />
      {body}
    </View>
  );
}
