// Figma V7.1 (R3IhhyNxNZuVINgUtJjZE3): 50 4984:12396 (cartão ativo), 50b 4984:13376 ("já foi aberto noutra conta" + Fechar),
// 50c ("já não está ativo" + Fechar). Rota `/emprestimo/{id}`; o link `/e/{id}` chega aqui pelo Task 7.
// Plano 8, Task 6: quem recebe abre o link, a app pede o claim (callable) e SÓ DEPOIS subscreve ao empréstimo e ao segredo
// (antes do claim nem o documento se lê). Cartão com o layout do cartão de prognóstico (MatchCard): competição, data e hora,
// equipas, recinto, só os campos do lugar que estão preenchidos, QR numa caixa branca e "Emprestada por {nome público}".
// Decisão do Martim (19/11): o destinatário NUNCA vê o número como texto, só a imagem do QR. O número não entra em Text,
// accessibilityLabel, testID, log, analytics nem mensagem de erro; a etiqueta do QR é genérica.
// Capturas e gravações bloqueadas em todo o ecrã (usePreventScreenCapture); brilho no máximo e ecrã sempre ligado (lib/ticketMode)
// só enquanto o cartão com o QR está à vista (LoanCard): os avisos e o a carregar não os ligam e a troca para "já não está ativo" liberta-os.
// Cancelado ou expirado com o ecrã aberto: o segredo falha com permissão negada (ou o documento mostra cancelledAt /
// expiresAt) e passa logo a "já não está ativo", sem QR e sem reabrir; a validade também se vigia aqui com um temporizador.
// Sem rede ao abrir: se a cache já tem o empréstimo preso a esta conta e ativo, mostra o cartão (o temporizador da validade
// continua a esconder o QR); senão, o aviso de sem ligação com "Tentar outra vez".
// SEM FIGMA (textos genéricos da app reutilizados): a carregar (espaço vazio, como as outras listas), sem rede e erro
// desconhecido ("Sem ligação..." e "Não foi possível concluir..." do empréstimo; "Tentar outra vez" do cofre biométrico).
import { useEffect, useReducer, useRef, useState } from 'react';
import Feather from '@expo/vector-icons/Feather';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { usePreventScreenCapture } from 'expo-screen-capture';
import { ScrollView, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { EmptyState } from '@/components/EmptyState';
import type { TeamVM } from '@/components/GameHeader';
import { Header } from '@/components/Header';
import { LOAN_TEXT, loanWhen } from '@/components/LoanConfirmSheet';
import { MatchCard } from '@/components/MatchCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { useLoan, useLoanSecret } from '@/data/loans';
import type { Loan } from '@/data/schemas';
import { SPORTING_API_ID } from '@/lib/teams';
import { useTicketMode } from '@/lib/ticketMode';
import { useGateCovered } from '@/providers/gateCover';
import { useSession } from '@/providers/SessionProvider';
import { claimLoan, LoanError, type LoanErrorCode } from '@/services/loans';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

export const LOAN_SCREEN_TEXT = {
  title: 'GameBox',
  openedElsewhere: 'Este empréstimo já foi aberto noutra conta.',
  inactive: 'Este empréstimo já não está ativo.',
  close: 'Fechar',
  retry: 'Tentar outra vez',
  qrLabel: 'Código QR da GameBox emprestada',
  lent: 'Emprestada',
  lentBy: 'Emprestada por',
  brightness: 'Brilho no máximo enquanto este ecrã está aberto',
  offline: LOAN_TEXT.errors.offline,
  unknown: LOAN_TEXT.errors.unknown,
} as const;

const LOAN_ID = /^[\w-]{1,64}$/;

const SEATS: { key: keyof Loan['seat']; label: string }[] = [
  { key: 'gate', label: 'Porta' },
  { key: 'sector', label: 'Sector' },
  { key: 'row', label: 'Fila' },
  { key: 'seat', label: 'Lugar' },
];

type Claim = { status: 'claiming' } | { status: 'claimed' | 'owner' } | { status: 'error'; code: LoanErrorCode };

/** Passou da validade? Re-renderiza no instante em que expira (o segredo só falha com permissão quando o cliente reabre). */
function useExpired(expiresAt: Date | null): boolean {
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const at = expiresAt ? expiresAt.getTime() : null;
  useEffect(() => {
    if (at === null) return undefined;
    const ms = at - Date.now();
    if (ms <= 0) return undefined;
    const handle = setTimeout(tick, Math.min(ms, 2 ** 31 - 1));
    return () => clearTimeout(handle);
  }, [at]);
  return at !== null && Date.now() >= at;
}

const team = (name: string, logo: string | null): TeamVM => ({ name, crestUrl: logo, id: name === 'Sporting CP' ? SPORTING_API_ID : null });

function Notice({ text, onClose, onRetry }: { text: string; onClose: () => void; onRetry?: () => void }) {
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.s24, paddingTop: space.s8, gap: space.s24 }}>
      <EmptyState icon="info" compact text={text} />
      <View style={{ gap: space.s12 }}>
        {onRetry ? <PrimaryButton label={LOAN_SCREEN_TEXT.retry} variant="primary" onPress={onRetry} /> : null}
        <PrimaryButton label={LOAN_SCREEN_TEXT.close} variant="outline" onPress={onClose} />
      </View>
    </ScrollView>
  );
}

function LoanCard({ loan, number }: { loan: Loan; number: string | null }) {
  useTicketMode(!useGateCovered());
  const { match } = loan;
  const seatValue = (k: keyof Loan['seat']): string => {
    const v: unknown = loan.seat[k];
    return typeof v === 'string' ? v.trim() : '';
  };
  const filled = SEATS.filter((s) => seatValue(s.key) !== '');
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: space.s24, paddingTop: layout.ticketTop, paddingBottom: space.s24, gap: layout.ticketBlockGap }}>
      <MatchCard
        testID="loan-card"
        home={team(match.homeName, match.homeLogo)}
        away={team(match.awayName, match.awayLogo)}
        competition={match.competition}
        kickoff={loanWhen(match.kickoff)}
        venue={LOAN_TEXT.venue[match.venue]}
      >
        {filled.length > 0 ? (
          <View style={{ flexDirection: 'row', alignSelf: 'stretch', gap: layout.ticketSeatGap }}>
            {filled.map((s) => (
              <View key={s.key} style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: layout.gameboxTextGap }}>
                <Text71 variant="badge11" numberOfLines={1}>{s.label}</Text71>
                <Text71 variant="title24" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={layout.ticketSeatMinScale}>
                  {seatValue(s.key)}
                </Text71>
              </View>
            ))}
          </View>
        ) : null}
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={LOAN_SCREEN_TEXT.qrLabel}
          style={{ backgroundColor: colors.white, borderRadius: radii.r16, padding: layout.loanQrPad, width: layout.loanQr + 2 * layout.loanQrPad, height: layout.loanQr + 2 * layout.loanQrPad }}
        >
          {number ? <QRCode value={number} size={layout.loanQr} color={colors.ink} backgroundColor={colors.white} quietZone={0} /> : null}
        </View>
        <Text71 variant="captionStrong12">{loan.ownerName ? `${LOAN_SCREEN_TEXT.lentBy} ${loan.ownerName}` : LOAN_SCREEN_TEXT.lent}</Text71>
      </MatchCard>
      <View
        style={{
          alignSelf: 'stretch',
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
        <Text71 variant="caption12" color="textMuted" style={{ flexShrink: 1 }}>{LOAN_SCREEN_TEXT.brightness}</Text71>
      </View>
    </ScrollView>
  );
}

export default function EmprestimoRoute() {
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  // Outro id (a rota reutiliza o ecrã): estado novo, nada do empréstimo anterior fica à vista.
  return <Emprestimo key={raw ?? ''} raw={raw} />;
}

function Emprestimo({ raw }: { raw: string | undefined }) {
  usePreventScreenCapture();
  const router = useRouter();
  const id = raw && LOAN_ID.test(raw) ? raw : null;
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const [claim, setClaim] = useState<Claim>({ status: 'claiming' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!id || !uid) return undefined;
    let alive = true;
    setClaim({ status: 'claiming' });
    claimLoan(id).then(
      (status) => alive && setClaim({ status }),
      (e: unknown) => alive && setClaim({ status: 'error', code: e instanceof LoanError ? e.code : 'unknown' }),
    );
    return () => {
      alive = false;
    };
  }, [id, uid, attempt]);

  // Só depois do claim: antes, as regras só deixam o dono ler. Com o claim falhado por falta de rede (sinal fraco à porta) subscreve-se
  // na mesma: se a cache já tem o empréstimo preso a esta conta e ativo, o cartão mostra-se com o segredo em cache.
  const offline = claim.status === 'error' && claim.code === 'offline';
  const open = claim.status === 'claimed' || claim.status === 'owner';
  const loan = useLoan(open || offline ? id : null);
  const secret = useLoanSecret(claim.status === 'claimed' || offline ? id : null);
  const loanData = loan.status === 'ready' ? loan.data : null;
  const pinned = loanData !== null && uid !== null && loanData.recipientUid === uid;
  // Empréstimo preso a esta conta visto sem rede: depois disso, um erro ou um em falta vindo do servidor é "já não está ativo".
  const pinnedSeen = useRef(false);
  if (offline && pinned) pinnedSeen.current = true;
  const tracked = claim.status === 'claimed' || (offline && pinned);
  const expired = useExpired(tracked ? (loanData?.expiresAt ?? null) : null);

  const ownerGamebox = claim.status === 'owner' && loanData ? loanData.gameboxId : null;
  useEffect(() => {
    if (ownerGamebox) router.replace(`/gamebox/${ownerGamebox}`);
  }, [ownerGamebox]);

  // Uma vez inativo, fica inativo (sem voltar a desenhar o QR se chegar um snapshot antigo).
  const dead = useRef(false);
  const gone = loan.status === 'missing' || loan.status === 'error' || secret.status === 'missing' || secret.status === 'error';
  if (
    !id ||
    (claim.status === 'error' && claim.code === 'inactive') ||
    (claim.status === 'claimed' && (gone || (loanData !== null && (loanData.cancelledAt !== null || expired)))) ||
    (offline && ((pinnedSeen.current && gone) || (pinned && (loanData.cancelledAt !== null || expired))))
  ) {
    dead.current = true;
  }

  let body;
  if (dead.current) {
    body = <Notice text={LOAN_SCREEN_TEXT.inactive} onClose={close} />;
  } else if (offline && pinned && loanData && secret.status === 'ready') {
    body = <LoanCard loan={loanData} number={secret.data.number} />;
  } else if (claim.status === 'error') {
    body =
      claim.code === 'claimed-by-other' ? (
        <Notice text={LOAN_SCREEN_TEXT.openedElsewhere} onClose={close} />
      ) : (
        <Notice
          text={claim.code === 'offline' ? LOAN_SCREEN_TEXT.offline : LOAN_SCREEN_TEXT.unknown}
          onClose={close}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      );
  } else if (claim.status === 'owner' && (loan.status === 'error' || loan.status === 'missing')) {
    body = <Notice text={LOAN_SCREEN_TEXT.inactive} onClose={close} />;
  } else if (claim.status === 'claimed' && loanData) {
    body = <LoanCard loan={loanData} number={secret.status === 'ready' ? secret.data.number : null} />;
  } else {
    body = <View testID="loan-loading" style={{ flex: 1 }} />;
  }

  return (
    <Screen padded="none">
      <Header title={LOAN_SCREEN_TEXT.title} onBack={close} />
      {body}
    </Screen>
  );
}
