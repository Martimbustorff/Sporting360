// Figma V7.1: 44 Gestão de GameBox (4951:9204). Linhas com arrastar (24), nome Title S 20 e seta (20), 18 pt acima e abaixo,
// separador de 1 pt; "+" branco de 60 a 24 pt da direita e de baixo. Lista por ordem, com arrastar: a pega à esquerda
// move a linha (PanResponder) e as ações de acessibilidade "Mover para cima/baixo" fazem o mesmo; só o campo `order` se grava.
// "Principal" é a GameBox antiga da V2 (users/{uid}.gameboxNumber): etiqueta e número, com opção de a copiar para a lista.
// Empréstimos recebidos (Figma V7.1 44L 4984:11926): depois das GameBox, linha "Sporting CP - FC Porto" com "Emprestada por {nome}",
// sem pega de arrastar, que abre /emprestimo/{id}; só os ativos (useRecipientLoans) e saem da lista no instante em que deixam de o ser.
// SEM FIGMA: esqueleto, erro, vazio, aviso de cache e o bloco "Principal" (botão PrimaryButton).
// Task 23: lista as GameBox do utilizador (gamebox, por `order`). Sem documentos e com número no perfil da V2,
// mostra-o como "Principal" e oferece copiá-lo para a coleção no formato da V2. users/{uid} nunca se altera.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import Feather from '@expo/vector-icons/Feather';
import { PanResponder, ScrollView, View } from 'react-native';
import { FormMessage } from '@/components/AuthForm';
import { EmptyState } from '@/components/EmptyState';
import { Header } from '@/components/Header';
import { OfflineBanner } from '@/components/OfflineBanner';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Screen } from '@/components/Screen';
import { Touchable } from '@/components/Touchable';
import { useMyUser } from '@/data/hooks';
import { useRecipientLoans, type LoanItem } from '@/data/loans';
import { useMyGameboxes } from '@/data/user';
import { formatGameboxNumber, gameboxLabel, resolveGameboxList, type GameboxInput } from '@/lib/gamebox';
import { useSession } from '@/providers/SessionProvider';
import { GameboxSaveError, reorderGameboxes, saveGamebox } from '@/services/gamebox';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MENU_DUO = require('../../../assets/icons/menu-duo.svg');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const FAB_PLUS = require('../../../assets/icons/fab-plus.svg');

export const GAMEBOX_TEXT = {
  title: 'Gestão de GameBox',
  loadError: 'Não foi possível carregar as tuas GameBox.',
  empty: 'Ainda não tens nenhuma GameBox. Toca em + para adicionar.',
  add: 'Adicionar GameBox',
  legacyHint: 'Esta GameBox está guardada no teu perfil da versão anterior.',
  legacySave: 'Guardar na minha GameBox',
  OFFLINE: 'Sem ligação. A GameBox não foi confirmada; tenta outra vez quando houver rede.',
  DENIED: 'Não tens permissão para guardar esta GameBox.',
  INVALID: 'O número da GameBox não é válido.',
  UNKNOWN: 'Não foi possível guardar. Tenta outra vez.',
  moveUp: 'Mover para cima',
  moveDown: 'Mover para baixo',
  reorderFailed: 'Não foi possível guardar a nova ordem. Tenta outra vez.',
} as const;

function LegacyPrincipal({ uid, legacy }: { uid: string; legacy: GameboxInput }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);
  // Repetir depois do tempo limite sem rede substitui a escrita pendente no mesmo documento (setDoc, não duplica);
  // outro erro larga o id.
  const pending = useRef<string | undefined>(undefined);
  const copy = async () => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setMessage(null);
    try {
      await saveGamebox(uid, legacy, undefined, 1, pending.current);
      // A lista passa a ter o documento e este bloco desaparece sozinho.
    } catch (e) {
      const err = e instanceof GameboxSaveError ? e : null;
      pending.current = err?.id;
      setMessage(GAMEBOX_TEXT[err?.saveCode as keyof typeof GAMEBOX_TEXT] ?? GAMEBOX_TEXT.UNKNOWN);
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };
  return (
    <View style={{ gap: layout.gameboxFieldsGap }}>
      <View style={{ gap: space.s8 }}>
        <Text71 variant="titleS20">{legacy.name}</Text71>
        <Text71 variant="body14" accessibilityLabel={legacy.number.replace(/\s+/g, '')}>{formatGameboxNumber(legacy.number)}</Text71>
        <Text71 variant="caption12" color="textMuted">{GAMEBOX_TEXT.legacyHint}</Text71>
      </View>
      {message ? <FormMessage text={message} /> : null}
      <PrimaryButton label={GAMEBOX_TEXT.legacySave} onPress={() => void copy()} loading={loading} />
    </View>
  );
}

const lentBy = (name: string | null) => (name ? `Emprestada por ${name}` : 'Emprestada');

function LentRow({ loan, onOpen }: { loan: LoanItem; onOpen: () => void }) {
  const title = `${loan.match.homeName} - ${loan.match.awayName}`;
  const sub = lentBy(loan.ownerName);
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={`${title}, ${sub}`}
      onPress={onOpen}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: layout.gameboxRowGap,
        paddingVertical: layout.loanRowPadY,
        borderBottomWidth: layout.separator,
        borderBottomColor: colors.separator,
      }}
    >
      <View style={{ flex: 1, minWidth: 0, gap: layout.gameboxTextGap }}>
        <Text71 variant="titleS20" numberOfLines={1} ellipsizeMode="tail">{title}</Text71>
        <Text71 variant="captionStrong12" color="primaryOnDark" numberOfLines={1} ellipsizeMode="tail">{sub}</Text71>
      </View>
      <Feather name="chevron-right" size={layout.gameboxRowArrow} color={colors.white} accessibilityElementsHidden importantForAccessibility="no" />
    </Touchable>
  );
}

type Item = { id: string; gameboxName: string; order: number };
type Drag = { id: string; from: number; to: number; dy: number };

const moved = <T,>(list: readonly T[], from: number, to: number): T[] => {
  const next = [...list];
  const [it] = next.splice(from, 1);
  next.splice(to, 0, it as T);
  return next;
};

type RowProps = {
  label: string;
  dragging: boolean;
  offset: number;
  onOpen: () => void;
  onStart: () => void;
  onMove: (dy: number) => void;
  onEnd: (dy: number) => void;
  onCancel: () => void;
  onShift: (by: -1 | 1) => void;
  onHeight?: (h: number) => void;
};

function GameboxRow(p: RowProps) {
  // O PanResponder vive para sempre; os callbacks mais recentes ficam num ref.
  const cb = useRef(p);
  cb.current = p;
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => cb.current.onStart(),
      onPanResponderMove: (_, g) => cb.current.onMove(g.dy),
      onPanResponderRelease: (_, g) => cb.current.onEnd(g.dy),
      onPanResponderTerminate: () => cb.current.onCancel(),
    }),
  ).current;
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={p.label}
      accessibilityActions={[
        { name: 'moveUp', label: GAMEBOX_TEXT.moveUp },
        { name: 'moveDown', label: GAMEBOX_TEXT.moveDown },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === 'moveUp') p.onShift(-1);
        if (e.nativeEvent.actionName === 'moveDown') p.onShift(1);
      }}
      onPress={p.onOpen}
      onLayout={(e) => p.onHeight?.(e.nativeEvent.layout.height)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: layout.gameboxRowGap,
        paddingVertical: layout.gameboxRowPadY,
        borderBottomWidth: layout.separator,
        borderBottomColor: colors.separator,
        backgroundColor: p.dragging ? colors.bgRaised : undefined,
        zIndex: p.dragging ? 1 : 0,
        transform: [{ translateY: p.offset }],
      }}
    >
      <View
        testID="gamebox-drag-handle"
        {...pan.panHandlers}
        hitSlop={{ top: space.s12, bottom: space.s12, left: space.s12, right: space.s12 }}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      >
        <Image source={MENU_DUO} style={{ width: layout.menuRowIcon, height: layout.menuRowIcon }} accessible={false} />
      </View>
      <Text71 variant="titleS20" numberOfLines={1} ellipsizeMode="tail" style={{ flex: 1, minWidth: 0 }}>
        {p.label}
      </Text71>
      <Feather name="chevron-right" size={layout.gameboxRowArrow} color={colors.white} accessibilityElementsHidden importantForAccessibility="no" />
    </Touchable>
  );
}

function ReorderableList({ list, onOpen, onDragging }: { list: Item[]; onOpen: (id: string) => void; onDragging: (on: boolean) => void }) {
  const [optimistic, setOptimistic] = useState<string[] | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // Altura medida da linha (arrastar anda de linha em linha); até ser medida usa a calculada dos tokens.
  const [rowH, setRowH] = useState(2 * layout.gameboxRowPadY + layout.menuRowIcon + layout.separator);
  const dragRef = useRef<Drag | null>(null);
  dragRef.current = drag;
  const isDragging = drag !== null;
  useEffect(() => onDragging(isDragging), [isDragging, onDragging]);

  // A lista em direto chegou com a nova ordem: deixa de valer a otimista.
  const signature = list.map((g) => `${g.id}:${g.order}`).join('|');
  useEffect(() => setOptimistic(null), [signature]);

  const ordered = useMemo(() => {
    if (!optimistic) return list;
    const byId = new Map(list.map((g) => [g.id, g]));
    const known = optimistic.flatMap((id) => (byId.has(id) ? [byId.get(id) as Item] : []));
    return known.length === list.length ? known : list;
  }, [list, optimistic]);

  const orders = useMemo(() => Object.fromEntries(list.map((g) => [g.id, g.order])), [list]);
  const commit = (from: number, to: number) => {
    if (from === to || to < 0 || to >= ordered.length) return;
    const ids = moved(ordered.map((g) => g.id), from, to);
    setOptimistic(ids);
    setMessage(null);
    reorderGameboxes(ids, orders).catch(() => {
      setOptimistic(null);
      setMessage(GAMEBOX_TEXT.reorderFailed);
    });
  };
  const target = (d: Drag, dy: number) => Math.max(0, Math.min(ordered.length - 1, d.from + Math.round(dy / rowH)));

  const shown = drag ? moved(ordered, drag.from, drag.to) : ordered;
  return (
    <>
      {shown.map((g) => {
        const i = ordered.findIndex((o) => o.id === g.id);
        const isDrag = drag?.id === g.id;
        return (
          <GameboxRow
            key={g.id}
            label={gameboxLabel(g.gameboxName, i)}
            dragging={isDrag}
            offset={isDrag && drag ? drag.dy - (drag.to - drag.from) * rowH : 0}
            onOpen={() => onOpen(g.id)}
            onStart={() => setDrag({ id: g.id, from: i, to: i, dy: 0 })}
            onMove={(dy) => setDrag((d) => (d ? { ...d, dy, to: target(d, dy) } : d))}
            onEnd={(dy) => {
              const d = dragRef.current;
              setDrag(null);
              if (d) commit(d.from, target(d, dy));
            }}
            onCancel={() => setDrag(null)}
            onShift={(by) => commit(i, i + by)}
            onHeight={i === 0 ? setRowH : undefined}
          />
        );
      })}
      {message ? <FormMessage text={message} /> : null}
    </>
  );
}

export default function Gamebox() {
  const router = useRouter();
  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const session = useSession();
  const uid = session.status === 'signedIn' ? session.user.uid : null;
  const boxes = useMyGameboxes(uid);
  const user = useMyUser(uid);
  const lentLoans = useRecipientLoans();
  const lent = lentLoans.status === 'ready' ? [...lentLoans.data].sort((a, b) => a.match.kickoff.getTime() - b.match.kickoff.getTime()) : [];

  const state = resolveGameboxList(boxes, user, uid);
  const [dragging, setDragging] = useState(false);

  let body;
  if (state.status === 'error') {
    body = <EmptyState icon="info" text={GAMEBOX_TEXT.loadError} />;
  } else if (state.status === 'loading' || !uid) {
    // Sem documentos espera-se pelo perfil (pode ter a GameBox antiga) antes de mostrar o vazio.
    body = <View testID="gamebox-loading" style={{ minHeight: layout.skeletonRowHeight }} />;
  } else {
    const { list, legacy } = state;
    body = (
      <>
        <OfflineBanner visible={state.fromCache} />
        <ScrollView
          scrollEnabled={!dragging}
          contentContainerStyle={{
            paddingHorizontal: space.s24,
            paddingTop: layout.gameboxListTop,
            paddingBottom: layout.gameboxFab + 2 * layout.gameboxFabEdge,
            gap: space.s16,
          }}
        >
          <View>
            <ReorderableList list={list} onOpen={(id) => router.push(`/gamebox/${id}`)} onDragging={setDragging} />
            {lent.map((l) => (
              <LentRow key={l.id} loan={l} onOpen={() => router.push(`/emprestimo/${l.id}`)} />
            ))}
          </View>
          {legacy ? <LegacyPrincipal uid={uid} legacy={legacy} /> : null}
          {list.length === 0 && !legacy && lent.length === 0 ? <EmptyState icon="info" text={GAMEBOX_TEXT.empty} /> : null}
        </ScrollView>
      </>
    );
  }

  return (
    <Screen padded="none">
      <Header title={GAMEBOX_TEXT.title} onBack={back} />
      {body}
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={GAMEBOX_TEXT.add}
        onPress={() => router.push('/gamebox/nova')}
        style={{ position: 'absolute', right: layout.gameboxFabEdge, bottom: layout.gameboxFabEdge }}
      >
        <Image source={FAB_PLUS} style={{ width: layout.gameboxFab, height: layout.gameboxFab }} accessible={false} />
      </Touchable>
    </Screen>
  );
}
