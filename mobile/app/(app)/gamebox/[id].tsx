// Figma: 327:15134 (editar: Número da Gamebox com ícone Qr_Code, Nome, cartão com contorno branco e tabs Estádio /
// Pavilhão com Porta, Sector, Fila, Lugar; "Apagar Gamebox"), 450:5633 (tab Estádio) e 450:5683 (tab Pavilhão), com o
// ✓ (Check_Big) no header para guardar. Campos com TextField (564:6907 / 564:6938), tabs com Tabs 'equal' (500:28814;
// sublinhado de 2 px em vez da barra de 6 px do nó, como nas outras tabs da app). Ícones qr-code.svg e check-big.svg
// descarregados dos nós. O botão "GUARDAR" de 327:15134 não se usa: os nós mais recentes guardam no ✓.
// SEM FIGMA: mensagens de erro e de rede, estados de carregamento e "já não existe".
// Task 23: /gamebox/nova cria, /gamebox/{id} edita. Lê `?numero=` (vindo do leitor, Task 24) para preencher o número;
// abre o leitor com `?from={id|nova}`. Apagar pede confirmação. Sem rede: mensagem clara e o formulário fica.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { FormMessage } from '@/components/AuthForm';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { Screen } from '@/components/Screen';
import { Tabs } from '@/components/Tabs';
import { TextField } from '@/components/TextField';
import { useMyGameboxes } from '@/data/user';
import {
  EMPTY_SEAT,
  fromGameboxDoc,
  gameboxLabel,
  gameboxNumberError,
  isEmptySeat,
  normalizeGameboxNumber,
  type GameboxInput,
  type Seat,
} from '@/lib/gamebox';
import { useSession } from '@/providers/SessionProvider';
import { deleteGamebox, GameboxSaveError, saveGamebox, type GameboxSaveCode } from '@/services/gamebox';
import { colors, layout, spacing, type } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const QR_CODE = require('../../../assets/icons/qr-code.svg');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const CHECK = require('../../../assets/icons/check-big.svg');

export const FORM_TEXT = {
  newTitle: 'Nova Gamebox',
  number: 'Número da GameBox',
  name: 'Nome',
  scan: 'Ler código da GameBox',
  save: 'Guardar',
  delete: 'Apagar Gamebox',
  digits: 'O número da GameBox tem só algarismos.',
  length: 'O número da GameBox tem entre 6 e 20 algarismos.',
  confirmTitle: 'Apagar Gamebox',
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

function GameboxFormView({
  uid,
  routeId,
  title,
  initial,
  existing,
  newOrder,
}: {
  uid: string;
  routeId: string;
  title: string;
  initial: Form;
  existing: { id: string; order: number } | null;
  newOrder: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [venue, setVenue] = useState<Venue>('stadium');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // Nova que ficou pendente sem rede: repetir grava no mesmo documento.
  const target = useRef(existing);
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
      if (e instanceof GameboxSaveError && e.id && !target.current) target.current = { id: e.id, order: newOrder };
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
      if (target.current) await saveGamebox(uid, input, target.current);
      else await saveGamebox(uid, input, undefined, newOrder);
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={FORM_TEXT.save}
            accessibilityState={{ disabled, busy }}
            disabled={disabled}
            onPress={save}
            hitSlop={12}
            style={{ opacity: disabled ? layout.disabledOpacity : 1 }}
          >
            <Image source={CHECK} style={{ width: layout.headerIcon, height: layout.headerIcon }} accessible={false} />
          </Pressable>
        }
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: spacing.screenXWide, paddingTop: spacing.xl, paddingBottom: spacing.xl }}
        >
          <View style={{ gap: layout.gameboxBlockGap }}>
            <View style={{ gap: layout.gameboxFieldsGap }}>
              <TextField
                label={FORM_TEXT.number}
                value={form.number}
                onChangeText={(v) => {
                  setForm((f) => ({ ...f, number: v }));
                  setMessage(null);
                }}
                error={numberError ? FORM_TEXT[numberError] : undefined}
                keyboardType="number-pad"
                accessory={
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={FORM_TEXT.scan}
                    onPress={() => router.push(`/gamebox/ler?from=${routeId}`)}
                    hitSlop={12}
                    style={{ minHeight: layout.minTouch, minWidth: layout.minTouch, alignItems: 'flex-end', justifyContent: 'center' }}
                  >
                    <Image source={QR_CODE} style={{ width: layout.headerIcon, height: layout.headerIcon }} accessible={false} />
                  </Pressable>
                }
              />
              <TextField
                label={FORM_TEXT.name}
                value={form.name}
                onChangeText={(v) => {
                  setForm((f) => ({ ...f, name: v }));
                  setMessage(null);
                }}
                autoCapitalize="words"
              />
            </View>
            <View
              style={{
                borderWidth: layout.gameboxCardBorder,
                borderColor: colors.white,
                borderRadius: layout.gameboxCardRadius,
                paddingHorizontal: layout.gameboxCardPadX,
                paddingTop: layout.gameboxCardPadTop,
                paddingBottom: layout.gameboxCardPadBottom,
                gap: layout.gameboxBlockGap,
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
              <View style={{ gap: layout.gameboxFieldsGap }}>
                {SEAT_FIELDS.map((f) => (
                  <TextField
                    key={`${venue}-${f.key}`}
                    label={f.label}
                    value={seat[f.key]}
                    onChangeText={(v) => setSeat(f.key, v)}
                    autoCapitalize="characters"
                  />
                ))}
              </View>
            </View>
            {message ? <FormMessage text={message} /> : null}
          </View>
          {existing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={FORM_TEXT.delete}
              disabled={busy}
              onPress={confirmDelete}
              hitSlop={12}
              style={{ marginTop: layout.gameboxDeleteTop, minHeight: layout.minTouch, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={type.authLinkAction}>{FORM_TEXT.delete}</Text>
            </Pressable>
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
  const nextOrder = boxes.status === 'ready' ? boxes.data.reduce((m, g) => Math.max(m, g.order), 0) + 1 : 1;

  // O formulário parte dos dados lidos uma só vez: as atualizações em direto não apagam o que se está a escrever.
  const [initial, setInitial] = useState<{ form: Form; title: string; existing: { id: string; order: number } | null; newOrder: number } | null>(null);
  useEffect(() => {
    if (initial !== null || !uid) return;
    const prefill = scanned ? normalizeGameboxNumber(scanned) ?? scanned : null;
    if (isNew && boxes.status !== 'loading') {
      setInitial({
        form: { number: prefill ?? '', name: '', stadium: EMPTY_SEAT, pavilion: EMPTY_SEAT },
        title: FORM_TEXT.newTitle,
        existing: null,
        newOrder: nextOrder,
      });
    } else if (!isNew && found) {
      const v = found.view;
      setInitial({
        form: { number: prefill ?? v.number, name: v.name, stadium: v.stadium, pavilion: v.pavilion ?? EMPTY_SEAT },
        title: gameboxLabel(v.name, found.index),
        existing: { id: v.id, order: v.order },
        newOrder: nextOrder,
      });
    }
  }, [initial, uid, isNew, boxes.status, found, scanned, nextOrder]);

  const title = isNew ? FORM_TEXT.newTitle : 'Gamebox';
  if (initial) {
    return (
      <GameboxFormView
        uid={uid as string}
        routeId={routeId}
        title={initial.title}
        initial={initial.form}
        existing={initial.existing}
        newOrder={initial.newOrder}
      />
    );
  }
  // Uma GameBox nova não depende da lista para se escrever; a lista com erro só impede editar.
  if (!isNew && boxes.status === 'error') {
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
