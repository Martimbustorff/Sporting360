// SEM FIGMA: tab Prognóstico sem frame vetorial; referência nas imagens da página "Appstore S360" (Mapa do Figma do
// Plano 4: "Vídeos, Prognóstico, MVP, cartão S360 MATCHDAY", ver 818:21042). Composto com tokens: dois Stepper com a
// caixa de resultado do GameHeader, PrimaryButton, FormMessage e a confirmação como folha inferior em Modal (o mesmo
// padrão da folha da password de apagar-conta, porque o Sheet é uma folha fixa do ecrã e não um diálogo).
// Regras (spec §6): uma submissão definitiva, só pela callable submitPrediction (services/game.ts); fecha ao apito
// inicial. A janela da app (lib/gameWindows.predictionOpen) só desenha a UI: o servidor decide e os seus códigos de
// erro dão as mensagens. Adiado (PST) fecha com explicação e reabre sozinho quando o jogo volta a NS.
// Task 17 (P52): com prognóstico (guardado ou acabado de enviar) há "Partilhar prognóstico", que abre o cartão
// "S360 MATCHDAY" (ShareCard) numa folha com "Partilhar" e "Fechar", como na referência 818:20427.
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Modal, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FormMessage } from '@/components/AuthForm';
import { EmptyState } from '@/components/EmptyState';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ShareCard } from '@/components/ShareCard';
import { Stepper } from '@/components/Stepper';
import type { Match } from '@/data/schemas';
import { useMyGamePoints, useMyPrediction, useSettlement } from '@/data/user';
import { countdownText } from '@/lib/countdown';
import { GameActionError, isKnockoutGame, predictionOpen, type GameActionCode } from '@/lib/gameWindows';
import { useSession } from '@/providers/SessionProvider';
import { predictionPoints } from '@/lib/predictionPoints';
import { reportCode } from '@/lib/report';
import { submitPrediction } from '@/services/game';
import { shareMatchday } from '@/services/share';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing, type } from '@/theme/tokens';
import { MatchScrollView } from '@/components/match/MatchScroll';

export const PREDICTION_TEXT = {
  rules: '+1 por participares, +3 resultado exato, +1 vencedor ou empate certo',
  cupRule: 'Nos jogos a eliminar conta o resultado com prolongamento; penáltis contam como empate.',
  submit: 'Submeter prognóstico',
  closed: 'Os prognósticos fecharam ao apito inicial.',
  postponed: 'Jogo adiado. Podes fazer o prognóstico quando houver nova data.',
  cancelled: 'Jogo cancelado. Sem pontos.',
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

const pointsText = (n: number) => `+${n} ${n === 1 ? 'ponto' : 'pontos'}`;

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

function Info({ text }: { text: string }) {
  return (
    <Body variant="body" style={{ textAlign: 'center', color: colors.textMuted }}>
      {text}
    </Body>
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
            Confirmar prognóstico
          </Text>
          <Body variant="body">{`É definitivo. Confirmas ${home}-${away}?`}</Body>
          <PrimaryButton label="Confirmar" onPress={onConfirm} />
          <PrimaryButton label="Cancelar" variant="secondary" onPress={onCancel} />
        </View>
      </View>
    </Modal>
  );
}

/** Folha com o cartão "S360 MATCHDAY": captura e partilha (imagem + texto com link); fecha depois de partilhar. */
function ShareSheet({ match, home, away, onClose }: { match: Match; home: number; away: number; onClose: () => void }) {
  const { bottom } = useSafeAreaInsets();
  const card = useRef<ComponentRef<typeof View>>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const share = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await shareMatchday(card, match, home, away);
      if (result === 'shared') onClose();
    } catch (e) {
      reportCode('SHARE_FAILED', e);
      setError(PREDICTION_TEXT.shareError);
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
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
            alignItems: 'stretch',
          }}
        >
          {/* A área do cartão vai até `shareCardInset` da borda do ecrã (o padding da folha é maior); o cartão
              escala-se sozinho para caber nela (ShareCard.shareCardScale). */}
          <View style={{ alignItems: 'center', marginHorizontal: layout.shareCardInset - layout.lockModalPad }}>
            <ShareCard ref={card} match={match} home={home} away={away} />
          </View>
          {error ? <FormMessage text={error} /> : null}
          <PrimaryButton label={PREDICTION_TEXT.shareSend} onPress={() => void share()} loading={sending} />
          <PrimaryButton label={PREDICTION_TEXT.shareClose} variant="secondary" onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

function SharePrediction({ match, home, away }: { match: Match; home: number; away: number }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ alignSelf: 'stretch' }}>
      <PrimaryButton label={PREDICTION_TEXT.share} variant="secondary" onPress={() => setOpen(true)} />
      {open ? <ShareSheet match={match} home={home} away={away} onClose={() => setOpen(false)} /> : null}
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

  if (sent) {
    return (
      <View style={{ gap: spacing.md, alignItems: 'center' }}>
        <MyPrediction home={sent.home} away={sent.away} />
        <SharePrediction match={match} home={sent.home} away={sent.away} />
      </View>
    );
  }

  const send = async () => {
    if (busy.current) return;
    busy.current = true;
    setConfirming(false);
    setSending(true);
    setError(null);
    try {
      await submitPrediction(match.id, home, away);
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

  return (
    <View style={{ gap: spacing.lg }}>
      <Info text={PREDICTION_TEXT.rules} />
      {isKnockoutGame(match.competition) ? <Info text={PREDICTION_TEXT.cupRule} /> : null}
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <Stepper
          label={match.home.name}
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
          value={away}
          onChange={(n) => {
            setAway(n);
            setError(null);
          }}
          min={0}
          max={MAX_GOALS}
        />
      </View>
      <Body variant="strip" style={{ textAlign: 'center' }}>
        {`Fecha em ${countdownText(match.kickoff.getTime() - now.getTime())}`}
      </Body>
      {error ? <FormMessage text={error} /> : null}
      <PrimaryButton label={PREDICTION_TEXT.submit} onPress={() => setConfirming(true)} loading={sending} />
      {confirming ? (
        <ConfirmSheet home={home} away={away} onConfirm={() => void send()} onCancel={() => setConfirming(false)} />
      ) : null}
    </View>
  );
}

function MyPrediction({ home, away }: { home: number; away: number }) {
  return (
    <Display variant="sectionScore" style={{ textAlign: 'center' }}>
      {`O teu prognóstico: ${home}-${away}`}
    </Display>
  );
}

export function PredictionTab({ match }: { match: Match }) {
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const prediction = useMyPrediction(match.id, uid);
  const settlement = useSettlement(match.id);
  const points = useMyGamePoints(match.id, uid);
  const now = usePredictionClock(match.kickoff);

  // O servidor disse que fechou (relógio do telemóvel adiantado/atrasado). Esquece-se quando o jogo muda de
  // estado ou de data (adiado que volta a NS), para o formulário poder reabrir.
  const [serverClosed, setServerClosed] = useState(false);
  const kickoffMs = match.kickoff.getTime();
  useEffect(() => {
    setServerClosed(false);
  }, [match.status, kickoffMs]);

  if (match.status === 'CANC') return <EmptyState icon="info" text={PREDICTION_TEXT.cancelled} />;
  if (session.status === 'signedOut') return <EmptyState icon="info" text={PREDICTION_TEXT.signedOut} />;
  if (prediction.status === 'loading') return <View testID="prediction-loading" />;
  if (prediction.status === 'error') return <EmptyState icon="info" text={PREDICTION_TEXT.error} />;

  const offline = prediction.status === 'ready' && prediction.fromCache === true;
  let body: React.JSX.Element;
  if (prediction.status === 'ready') {
    const settled = settlement.status === 'ready' ? settlement.data : null;
    body = (
      <View style={{ gap: spacing.md, alignItems: 'center' }}>
        {settled ? (
          <Display variant="sectionScore" style={{ textAlign: 'center' }}>
            {`Resultado final: ${settled.finalHome}-${settled.finalAway}`}
          </Display>
        ) : null}
        <MyPrediction home={prediction.data.home} away={prediction.data.away} />
        {settled && points.status === 'ready' ? (
          <Display variant="screenTitle" style={{ textAlign: 'center' }}>
            {pointsText(predictionPoints(points.data))}
          </Display>
        ) : null}
        <SharePrediction match={match} home={prediction.data.home} away={prediction.data.away} />
      </View>
    );
  } else if (match.status === 'PST') {
    body = <EmptyState icon="info" text={PREDICTION_TEXT.postponed} />;
  } else if (!serverClosed && predictionOpen(match, now)) {
    // `key`: um jogo adiado que volta com nova data começa de novo em 0-0.
    body = <PredictionForm key={kickoffMs} match={match} now={now} onClosed={() => setServerClosed(true)} />;
  } else {
    body = <EmptyState icon="info" text={PREDICTION_TEXT.closed} />;
  }

  return (
    <MatchScrollView
      testID="prediction-tab"
      contentContainerStyle={{ paddingHorizontal: spacing.screenX, paddingTop: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}
    >
      <OfflineBanner visible={offline} />
      {body}
    </MatchScrollView>
  );
}
