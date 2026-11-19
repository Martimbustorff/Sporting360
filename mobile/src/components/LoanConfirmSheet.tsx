// Figma V7.1 (R3IhhyNxNZuVINgUtJjZE3): 45Lb 4984:11545 (folha "Emprestar para o próximo jogo": um só jogo, botão
// "Emprestar"), 45Lbv 4984:11626 (sem jogo: "Fechar"), 45Le 4985:11932 (confirmação de cancelar). Folhas escuras
// (ModalSheet, grabber ao centro). Só se empresta o PRÓXIMO jogo em casa do recinto: sem lista nem escolha. O jogo vem do
// mesmo cálculo do modo bilhete (lib/gamebox upcomingHome), depois de filtrar pelo recinto, para a app oferecer exatamente
// o jogo que o servidor aceita. Plano 9: o jogo mais próximo entre os recintos com lugar preenchido (lendVenues). SEM FIGMA: mensagens de erro e o estado a carregar. Nunca se regista o número nem nomes.
import { useRef, useState } from 'react';
import { Share, View } from 'react-native';
import { FormMessage } from '@/components/AuthForm';
import { TeamCrest } from '@/components/GameHeader';
import { ModalSheet } from '@/components/ModalSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { useNow } from '@/data/clock';
import type { Match } from '@/data/schemas';
import { useUpcomingMatches } from '@/data/sports';
import { loanableAcross, ticketVenue, venueSports, VENUE_NAMES, type TicketVenue } from '@/lib/gamebox';
import { formatCardDate, formatTime } from '@/lib/ptDate';
import { cancelLoan, createLoan, LoanError, loanShareText, type LoanErrorCode } from '@/services/loans';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

export const LOAN_TEXT = {
  lend: 'Emprestar para o próximo jogo',
  lendHint: 'O link só abre na app S360 e expira no fim deste jogo.',
  confirm: 'Emprestar',
  close: 'Fechar',
  none: 'Sem jogos em casa marcados para esta GameBox.',
  lentFor: 'Emprestada para',
  notOpened: 'Ainda não aberto',
  cancel: 'Cancelar empréstimo',
  // Figma 45Lc (botão 4989:11988): partilhar o link outra vez (empréstimo ainda não aberto).
  shareAgain: 'Partilhar link outra vez',
  cancelTitle: 'Cancelar empréstimo?',
  cancelBody: 'Quem recebeu deixa de ver a GameBox para este jogo.',
  back: 'Voltar',
  lentForThisGame: 'Emprestada para este jogo',
  editNote: 'Se alterares o número ou o lugar, o empréstimo é cancelado.',
  lentForThisGameHint: 'Cancela o empréstimo para voltares a usar o código.',
  venue: { stadium: `Estádio ${VENUE_NAMES.stadium}`, pavilion: `Pavilhão ${VENUE_NAMES.pavilion}` },
  errors: {
    exists: 'Esta GameBox já está emprestada.',
    offline: 'Sem ligação. Tenta outra vez quando houver rede.',
    'not-next': 'Este jogo já não está disponível para empréstimo.',
    'not-home': 'Este jogo já não está disponível para empréstimo.',
    finished: 'Este jogo já não está disponível para empréstimo.',
    'claimed-by-other': 'Não foi possível concluir. Tenta outra vez.',
    inactive: 'Não foi possível concluir. Tenta outra vez.',
    unknown: 'Não foi possível concluir. Tenta outra vez.',
  } satisfies Record<LoanErrorCode, string>,
} as const;

const errorText = (e: unknown): string => LOAN_TEXT.errors[e instanceof LoanError ? e.code : 'unknown'];

/** "dom 22 nov · 20:30" */
export const loanWhen = (kickoff: Date): string => `${formatCardDate(kickoff).toLowerCase()} · ${formatTime(kickoff)}`;

/**
 * Os jogos dos recintos em causa (fixos enquanto a folha está aberta). Só se oferece um jogo com TODAS as listas lidas (o
 * Pavilhão tem cinco): com uma por chegar o mais cedo podia não ser o próximo e o servidor responderia `not-next`. Com uma
 * lista em erro não se oferece nenhum. Com mais de um recinto, o jogo em casa mais próximo.
 */
function useVenueMatches(venues: readonly TicketVenue[], now: Date): { match: Match | null; loading: boolean; error: boolean } {
  const sports = venues.flatMap((v) => venueSports(v));
  const lists = sports.map((s) => useUpcomingMatches(s, now)); // eslint-disable-line react-hooks/rules-of-hooks
  const error = lists.some((l) => l.status === 'error');
  const loading = !error && lists.some((l) => l.status === 'loading');
  if (error || loading) return { match: null, loading, error };
  const matches = lists.flatMap((l) => (l.status === 'ready' ? l.data : []));
  return { match: loanableAcross(matches, venues, now), loading: false, error: false };
}

function GameCard({ match }: { match: Match }) {
  const venue = ticketVenue(match.sport);
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: layout.loanCardGap,
        backgroundColor: colors.surface10,
        borderRadius: radii.r16,
        paddingHorizontal: layout.loanCardPadX,
        paddingVertical: layout.loanCardPadY,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}>
        <TeamCrest size="sm" team={{ id: Number(match.home.id), name: match.home.name, crestUrl: match.home.logo }} />
        <TeamCrest size="sm" team={{ id: Number(match.away.id), name: match.away.name, crestUrl: match.away.logo }} />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: layout.gameboxTextGap }}>
        <Text71 variant="label16" numberOfLines={2}>{`${match.home.name} - ${match.away.name}`}</Text71>
        <Text71 variant="caption12" color="textMuted">{loanWhen(match.kickoff)}</Text71>
        <Text71 variant="caption12" color="textMuted">{LOAN_TEXT.venue[venue]}</Text71>
      </View>
    </View>
  );
}

/** Folha de confirmação: o próximo jogo em casa do recinto, "Emprestar" cria o empréstimo e abre a partilha. */
export function LoanConfirmSheet({
  gameboxId,
  number,
  venues,
  onClose,
}: {
  gameboxId: string;
  /** Número da GameBox já decifrado (decryptGameboxNumber); nunca se regista. */
  number: string;
  /** Recintos em que se pode emprestar (lib/gamebox lendVenues); fixos enquanto a folha está aberta. */
  venues: readonly TicketVenue[];
  onClose: () => void;
}) {
  const now = useNow(60_000);
  const { match, loading, error } = useVenueMatches(venues, now);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const busyRef = useRef(false);

  const lend = async () => {
    if (!match || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const { url } = await createLoan(gameboxId, match.id, number);
      onClose();
      // O empréstimo já existe: se a folha de partilha falhar ou for fechada, o cartão ativo continua no ecrã.
      await Share.share({ message: loanShareText({ homeName: match.home.name, awayName: match.away.name, url }) }).catch(() => undefined);
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <ModalSheet grabber="center" onClose={onClose}>
      <Text71 variant="titleS20" accessibilityRole="header">{LOAN_TEXT.lend}</Text71>
      {match ? (
        <>
          <Text71 variant="caption12" color="textMuted">{LOAN_TEXT.lendHint}</Text71>
          <GameCard match={match} />
          {message ? <FormMessage text={message} /> : null}
          <PrimaryButton label={LOAN_TEXT.confirm} onPress={() => void lend()} loading={busy} />
        </>
      ) : (
        <>
          {loading ? null : (
            <Text71 variant="body14" color={error ? 'danger' : 'textMuted'} style={{ textAlign: 'center' }}>
              {error ? LOAN_TEXT.errors.unknown : LOAN_TEXT.none}
            </Text71>
          )}
          <PrimaryButton label={LOAN_TEXT.close} variant="outline" onPress={onClose} />
        </>
      )}
    </ModalSheet>
  );
}

/** 45Le: "Cancelar empréstimo?" com a ação destrutiva a primário e "Voltar" a contorno. */
export function CancelLoanSheet({ loanId, onClose }: { loanId: string; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const busyRef = useRef(false);
  const run = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await cancelLoan(loanId);
      onClose();
    } catch (e) {
      setMessage(errorText(e));
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  return (
    <ModalSheet grabber="center" onClose={onClose}>
      <Text71 variant="titleS20" accessibilityRole="header">{LOAN_TEXT.cancelTitle}</Text71>
      <Text71 variant="body14" color="textMuted">{LOAN_TEXT.cancelBody}</Text71>
      {message ? <FormMessage text={message} /> : null}
      <PrimaryButton label={LOAN_TEXT.cancel} onPress={() => void run()} loading={busy} />
      <PrimaryButton label={LOAN_TEXT.back} variant="outline" onPress={onClose} disabled={busy} />
    </ModalSheet>
  );
}
