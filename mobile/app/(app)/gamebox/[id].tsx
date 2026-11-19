// Figma V7.1: 45 Editar GameBox (4951:9265) e 49b Apagar (alerta nativo, ação a vermelho). Título "GAMEBOX", visto (Check) no
// cabeçalho para guardar; número (TextField) com botão de ler o código 48x48 (surface-10, raio 12), nome, cartão com contorno
// branco e raio 16 com tabs Estádio / Pavilhão e Porta, Sector, Fila, Lugar em quatro campos; "Apagar GameBox" a danger
// (Caption Strong 12). Ícones qr-code.svg e check-big.svg do Figma. O alerta de apagar é o nativo (Alert) com estilo destrutivo.
// SEM FIGMA: mensagens de erro e de rede, estados de carregamento e "já não existe".
// Task 23: /gamebox/nova cria, /gamebox/{id} edita. Lê `?numero=` (vindo do leitor, Task 24) para preencher o número;
// abre o leitor com `?from={id|nova}`. Task 24 (F12 revisto): o leitor volta a esta mesma instância com `dismissTo` e um
// `numero` novo; só o número muda, o resto do que se escreveu fica. Apagar pede confirmação. Sem rede: mensagem clara e o formulário fica.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Alert, ScrollView, Share, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { FormMessage } from '@/components/AuthForm';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Tabs } from '@/components/Tabs';
import { TextField } from '@/components/TextField';
import { CancelLoanSheet, LOAN_TEXT, LoanConfirmSheet, loanWhen } from '@/components/LoanConfirmSheet';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Touchable } from '@/components/Touchable';
import { dismissOwnerLoanNotice, useOwnerLoanNotice, useOwnerLoans, type LoanItem } from '@/data/loans';
import { useMyGameboxes } from '@/data/user';
import { formatTime } from '@/lib/ptDate';
import { loanLink } from '@/lib/shareLink';
import { loanShareText } from '@/services/loans';
import {
  EMPTY_SEAT,
  fromGameboxDoc,
  gameboxNumberError,
  isEmptySeat,
  lendVenues,
  normalizeGameboxNumber,
  type GameboxInput,
  type Seat,
  type TicketVenue,
} from '@/lib/gamebox';
import { useSession } from '@/providers/SessionProvider';
import { deleteGamebox, GameboxSaveError, saveGamebox, type GameboxSaveCode } from '@/services/gamebox';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const QR_CODE = require('../../../assets/icons/qr-code.svg');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CHECK = require('../../../assets/icons/check-big.svg');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CLOSE = require('../../../assets/icons/close.svg');

export const FORM_TEXT = {
  title: 'GameBox',
  newTitle: 'Nova GameBox',
  number: 'Número da GameBox',
  name: 'Nome',
  scan: 'Ler código da GameBox',
  save: 'Guardar',
  delete: 'Apagar GameBox',
  recipientLeft: 'Quem recebeu esta GameBox apagou a conta. O empréstimo foi cancelado.',
  closeNotice: 'Fechar aviso',
  digits: 'O número da GameBox tem só algarismos.',
  length: 'O número da GameBox tem entre 6 e 20 algarismos.',
  confirmTitle: 'Apagar GameBox',
  confirmBody: 'Queres mesmo apagar esta GameBox? Esta ação não se pode desfazer.',
  cancel: 'Cancelar',
  confirm: 'Apagar',
  loadError: 'Não foi possível carregar as tuas GameBox.',
  notFound: 'Esta GameBox já não existe.',
  OFFLINE: 'Sem ligação. As alterações não foram confirmadas; mantemos o que escreveste. Tenta outra vez quando houver rede.',
  DENIED: 'Não tens permissão para alterar esta GameBox.',
  INVALID: 'O número da GameBox não é válido.',
  UNKNOWN: 'Não foi possível concluir. Tenta outra vez.',
} as const;

type Venue = 'stadium' | 'pavilion';
type Form = { number: string; name: string; stadium: Seat; pavilion: Seat };
const SEAT_FIELDS: { key: keyof Seat; label: string }[] = [
  { key: 'port', label: 'Porta' },
  { key: 'sector', label: 'Sector' },
  { key: 'line', label: 'Fila' },
  { key: 'seat', label: 'Lugar' },
];
const codeOfError = (e: unknown): GameboxSaveCode => (e instanceof GameboxSaveError ? e.saveCode : 'UNKNOWN');

/** 45Lr (4994:13335): quem recebeu apagou a conta. Por cima do botão de emprestar; o X (44 pt) fecha-o para sempre. */
function RecipientLeftNotice({ loanId }: { loanId: string }) {
  return (
    <View
      testID="loan-notice"
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s8,
        backgroundColor: colors.surface20,
        borderRadius: layout.loanNoticeRadius,
        paddingLeft: layout.loanNoticePadLeft,
        paddingRight: layout.loanNoticePad,
        paddingVertical: layout.loanNoticePad,
        overflow: 'hidden',
      }}
    >
      <Text71 variant="caption12" style={{ flex: 1, minWidth: 0 }}>{FORM_TEXT.recipientLeft}</Text71>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={FORM_TEXT.closeNotice}
        onPress={() => dismissOwnerLoanNotice(loanId)}
        style={{ width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center' }}
      >
        <Image source={CLOSE} style={{ width: layout.headerIcon, height: layout.headerIcon }} accessible={false} />
      </Touchable>
    </View>
  );
}

/** 45La / 45Lc / 45Ld / 45Lr: botão de emprestar, ou o cartão do empréstimo ativo com "Cancelar empréstimo". Uma só por GameBox. */
function LoanSection({ gameboxId, number, venues }: { gameboxId: string; number: string; venues: readonly TicketVenue[] }) {
  const loans = useOwnerLoans(gameboxId);
  const notice = useOwnerLoanNotice(gameboxId);
  const [sheet, setSheet] = useState<'lend' | 'cancel' | null>(null);
  if (loans.status !== 'ready') return null;
  const active: LoanItem | undefined = loans.data[0];
  const close = () => setSheet(null);
  return (
    <>
      {active ? (
        <View style={{ gap: layout.loanBlockGap }}>
          <View style={{ gap: layout.loanStateGap, padding: space.s16, borderRadius: radii.r16, backgroundColor: colors.surface06, overflow: 'hidden' }}>
            <Text71 variant="strong14">{`${LOAN_TEXT.lentFor} ${active.match.homeName} - ${active.match.awayName}`}</Text71>
            <Text71 variant="caption12" color="textMuted">{loanWhen(active.match.kickoff)}</Text71>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.loanStateGap }}>
              <View
                style={{
                  width: layout.loanDot,
                  height: layout.loanDot,
                  borderRadius: layout.loanDot / 2,
                  backgroundColor: active.openedAt ? colors.primaryOnDark : colors.textSubtle,
                }}
              />
              <Text71 variant="captionStrong12" color={active.openedAt ? 'primaryOnDark' : 'white'} style={{ flexShrink: 1 }}>
                {active.openedAt && active.recipientName
                  ? `Aberto por ${active.recipientName} às ${formatTime(active.openedAt)}`
                  : LOAN_TEXT.notOpened}
              </Text71>
            </View>
          </View>
          <Text71 variant="caption12" color="textMuted">{LOAN_TEXT.editNote}</Text71>
          {active.openedAt ? null : (
            <PrimaryButton
              label={LOAN_TEXT.shareAgain}
              variant="outline"
              onPress={() =>
                void Share.share({
                  message: loanShareText({ homeName: active.match.homeName, awayName: active.match.awayName, url: loanLink(active.id) }),
                }).catch(() => undefined)
              }
            />
          )}
          <PrimaryButton label={LOAN_TEXT.cancel} variant="outline" onPress={() => setSheet('cancel')} />
        </View>
      ) : (
        <View style={{ gap: space.s8 }}>
          {notice ? <RecipientLeftNotice loanId={notice.loanId} /> : null}
          <PrimaryButton label={LOAN_TEXT.lend} onPress={() => setSheet('lend')} />
          <Text71 variant="caption12" color="textMuted">{LOAN_TEXT.lendHint}</Text71>
        </View>
      )}
      {sheet === 'lend' && !active ? <LoanConfirmSheet gameboxId={gameboxId} number={number} venues={venues} onClose={close} /> : null}
      {sheet === 'cancel' && active ? <CancelLoanSheet loanId={active.id} onClose={close} /> : null}
    </>
  );
}

function GameboxFormView({
  uid,
  routeId,
  title,
  initial,
  existing,
  newOrder,
  loanNumber,
  scanned,
}: {
  uid: string;
  routeId: string;
  title: string;
  initial: Form;
  existing: { id: string; order: number } | null;
  newOrder: number;
  /** Número guardado, decifrado, para o empréstimo (o do formulário pode ter edições por guardar). */
  loanNumber: string;
  scanned: string | undefined;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  // Número lido pelo leitor depois de o formulário já existir: substitui só o número.
  useEffect(() => {
    const n = scanned ? normalizeGameboxNumber(scanned) : null;
    if (n) setForm((f) => (f.number === n ? f : { ...f, number: n }));
  }, [scanned]);
  const [venue, setVenue] = useState<Venue>('stadium');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // Nova cuja escrita ficou pendente (tempo limite sem rede): repetir substitui-a no mesmo documento (setDoc).
  // Outro erro larga o id e a tentativa seguinte começa do zero.
  const reserved = useRef<string | undefined>(undefined);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/gamebox'));

  const numberError = gameboxNumberError(form.number);
  const valid = normalizeGameboxNumber(form.number) !== null;
  const setSeat = (k: keyof Seat, v: string) => {
    setForm((f) => ({ ...f, [venue]: { ...f[venue], [k]: v } }));
    setMessage(null);
  };

  const run = async (action: () => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      await action();
      router.replace('/gamebox');
    } catch (e) {
      if (!existing) reserved.current = e instanceof GameboxSaveError ? e.id : undefined;
      setMessage(FORM_TEXT[codeOfError(e)]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const save = () => {
    if (!valid) return;
    const input: GameboxInput = {
      number: form.number,
      name: form.name,
      stadium: form.stadium,
      pavilion: isEmptySeat(form.pavilion) ? null : form.pavilion,
    };
    void run(async () => {
      if (existing) await saveGamebox(uid, input, existing);
      else await saveGamebox(uid, input, undefined, newOrder, reserved.current);
    });
  };

  const confirmDelete = () => {
    if (!existing) return;
    Alert.alert(FORM_TEXT.confirmTitle, FORM_TEXT.confirmBody, [
      { text: FORM_TEXT.cancel, style: 'cancel' },
      { text: FORM_TEXT.confirm, style: 'destructive', onPress: () => run(() => deleteGamebox(existing.id)) },
    ]);
  };

  const disabled = !valid || busy;
  const seat = form[venue];
  return (
    <Screen padded="none">
      <Header
        title={title}
        onBack={back}
        right={
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={FORM_TEXT.save}
            accessibilityState={{ disabled, busy }}
            disabled={disabled}
            onPress={save}
            style={{ width: layout.minTouch, height: layout.minTouch, alignItems: 'center', justifyContent: 'center', opacity: disabled ? layout.disabledOpacity : 1 }}
          >
            <Image source={CHECK} style={{ width: layout.headerIcon, height: layout.headerIcon }} accessible={false} />
          </Touchable>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: space.s24,
            paddingTop: layout.gameboxContentTop,
            paddingBottom: space.s24,
            gap: layout.gameboxBlockGap,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.s12 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <TextField
                label={FORM_TEXT.number}
                value={form.number}
                onChangeText={(v) => {
                  setForm((f) => ({ ...f, number: v }));
                  setMessage(null);
                }}
                error={numberError ? FORM_TEXT[numberError] : undefined}
                keyboardType="number-pad"
              />
            </View>
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={FORM_TEXT.scan}
              onPress={() => router.push(`/gamebox/ler?from=${routeId}`)}
              style={{
                width: layout.gameboxScanButton,
                height: layout.gameboxScanButton,
                marginTop: layout.gameboxScanOffset,
                borderRadius: radii.r12,
                backgroundColor: colors.surface10,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Image source={QR_CODE} style={{ width: layout.headerIcon, height: layout.headerIcon }} accessible={false} />
            </Touchable>
          </View>
          <TextField
            label={FORM_TEXT.name}
            value={form.name}
            onChangeText={(v) => {
              setForm((f) => ({ ...f, name: v }));
              setMessage(null);
            }}
            autoCapitalize="words"
          />
          <View
            style={{
              borderWidth: layout.separator,
              borderColor: colors.white,
              borderRadius: radii.r16,
              paddingHorizontal: layout.gameboxSeatsPadX,
              paddingTop: layout.gameboxSeatsPadTop,
              paddingBottom: layout.gameboxSeatsPadBottom,
              gap: layout.gameboxSeatsGap,
            }}
          >
            <Tabs<Venue>
              mode="equal"
              items={[
                { key: 'stadium', label: 'Estádio' },
                { key: 'pavilion', label: 'Pavilhão' },
              ]}
              value={venue}
              onChange={setVenue}
            />
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: layout.gameboxSeatsFieldsGap }}>
              {SEAT_FIELDS.map((f) => (
                <View key={`${venue}-${f.key}`} style={{ flex: 1, minWidth: 0 }}>
                  <TextField label={f.label} value={seat[f.key]} onChangeText={(v) => setSeat(f.key, v)} autoCapitalize="characters" />
                </View>
              ))}
            </View>
          </View>
          {existing && normalizeGameboxNumber(loanNumber) ? (
            <LoanSection
              gameboxId={existing.id}
              number={normalizeGameboxNumber(loanNumber) as string}
              venues={lendVenues(initial.stadium, initial.pavilion)}
            />
          ) : null}
          {message ? <FormMessage text={message} /> : null}
          {existing ? (
            <Touchable
              accessibilityRole="button"
              accessibilityLabel={FORM_TEXT.delete}
              disabled={busy}
              onPress={confirmDelete}
              style={{ alignSelf: 'flex-start', minHeight: layout.minTouch, justifyContent: 'center' }}
            >
              <Text71 variant="captionStrong12" color="danger">{FORM_TEXT.delete}</Text71>
            </Touchable>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const router = useRouter();
  return (
    <Screen padded="none">
      <Header title={title} onBack={() => (router.canGoBack() ? router.back() : router.replace('/gamebox'))} />
      {children}
    </Screen>
  );
}

const single = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v);

export default function GameboxEditar() {
  const params = useLocalSearchParams<{ id?: string; numero?: string }>();
  const routeId = single(params.id) ?? 'nova';
  const scanned = single(params.numero);
  const isNew = routeId === 'nova';
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const boxes = useMyGameboxes(uid);

  const found = useMemo(() => {
    if (boxes.status !== 'ready' || !uid) return null;
    const i = boxes.data.findIndex((g) => g.id === routeId);
    const doc = boxes.data[i];
    return doc ? { view: fromGameboxDoc(doc, uid), index: i } : null;
  }, [boxes, routeId, uid]);
  // Só se calcula com a lista lida: uma GameBox nova nunca recebe uma ordem inventada (podia repetir uma existente).
  const nextOrder = boxes.status === 'ready' ? boxes.data.reduce((m, g) => Math.max(m, g.order), 0) + 1 : null;

  // O formulário parte dos dados lidos uma só vez: as atualizações em direto não apagam o que se está a escrever.
  const [initial, setInitial] = useState<{ form: Form; title: string; existing: { id: string; order: number } | null; newOrder: number; loanNumber: string } | null>(null);
  useEffect(() => {
    if (initial !== null || !uid) return;
    const prefill = scanned ? normalizeGameboxNumber(scanned) ?? scanned : null;
    if (isNew && nextOrder !== null) {
      setInitial({
        form: { number: prefill ?? '', name: '', stadium: EMPTY_SEAT, pavilion: EMPTY_SEAT },
        title: FORM_TEXT.newTitle,
        existing: null,
        newOrder: nextOrder,
        loanNumber: '',
      });
    } else if (!isNew && found) {
      const v = found.view;
      setInitial({
        form: { number: prefill ?? v.number, name: v.name, stadium: v.stadium, pavilion: v.pavilion ?? EMPTY_SEAT },
        title: FORM_TEXT.title,
        existing: { id: v.id, order: v.order },
        newOrder: nextOrder ?? v.order,
        loanNumber: v.number,
      });
    }
  }, [initial, uid, isNew, boxes.status, found, scanned, nextOrder]);

  const title = isNew ? FORM_TEXT.newTitle : FORM_TEXT.title;
  if (initial) {
    return (
      <GameboxFormView
        uid={uid as string}
        routeId={routeId}
        title={initial.title}
        initial={initial.form}
        existing={initial.existing}
        newOrder={initial.newOrder}
        loanNumber={initial.loanNumber}
        scanned={scanned}
      />
    );
  }
  // Com a lista por ler não se cria nem edita: a ordem de uma nova depende das que já existem.
  if (boxes.status === 'error') {
    return (
      <Shell title={title}>
        <EmptyState icon="info" text={FORM_TEXT.loadError} />
      </Shell>
    );
  }
  if (!isNew && boxes.status === 'ready' && !found) {
    return (
      <Shell title={title}>
        <EmptyState icon="info" text={FORM_TEXT.notFound} />
      </Shell>
    );
  }
  return (
    <Shell title={title}>
      <View testID="gamebox-form-loading" style={{ minHeight: layout.skeletonRowHeight }} />
    </Shell>
  );
}
