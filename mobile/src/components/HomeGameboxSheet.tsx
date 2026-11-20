// Figma V7.1: folha recolhida 4920:5083 (branca, "GameBox Digital" a primary); aberta com GameBox 4951:8673 e sem GameBox
// 4951:9190 (fundo bg, título primary-on-dark, seta para baixo, fundo escurecido por trás). Frames 43 e 43b da Home.
// Task 24: lê as GameBox do utilizador (useMyGameboxes) e mostra uma página por GameBox. Sem documentos e com número
// antigo em users/{uid}.gameboxNumber mostra-o como "Principal" (mesma regra da lista, resolveGameboxList).
// Tocar no QR abre o modo bilhete `/gamebox/bilhete?id={id}` (`onOpenTicket` troca o destino).
// SEM FIGMA: esqueleto de carregamento e erro de leitura.
import { haptic } from '@/lib/haptics';
import { useState } from 'react';
import { Image } from 'expo-image';
import { useRouter, type Href } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARD_TEXT, GameboxCard } from '@/components/GameboxCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { Sheet } from '@/components/Sheet';
import { Touchable } from '@/components/Touchable';
import { useMyUser } from '@/data/hooks';
import { useMyGameboxes } from '@/data/user';
import { fromGameboxDoc, normalizeGameboxNumber, resolveGameboxList, type GameboxView } from '@/lib/gamebox';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

const CAMERA = require('../../assets/icons/camera-large.svg');

export const SHEET_TEXT = {
  title: 'GameBox Digital',
  scan: 'Digitalizar',
  emptyBefore: 'Digitaliza o código de barras da tua GameBox ou ',
  manual: 'insere manualmente',
  emptyAfter: ' o número.',
  loadError: 'Não foi possível carregar as tuas GameBox.',
  unreadable: CARD_TEXT.unreadable,
  close: 'Fechar a GameBox Digital',
} as const;

/** Altura visível da folha recolhida: padding, linha do título e a zona do indicador home. */
export function useGameboxSheetCollapsedHeight(): number {
  const { bottom } = useSafeAreaInsets();
  return layout.sheetPadYCollapsed + layout.minTouch + Math.max(bottom, layout.homeIndicator);
}

/** Rota do modo bilhete de uma GameBox (Tarefa 5). */
export const ticketHref = (id: string): Href => `/gamebox/bilhete?id=${encodeURIComponent(id)}`;

function Empty() {
  const router = useRouter();
  return (
    <View style={{ gap: layout.gameboxEmptyGapOpen, alignItems: 'stretch' }}>
      <Image
        source={CAMERA}
        accessible={false}
        style={{ width: layout.gameboxCamera, height: layout.gameboxCamera, alignSelf: 'center' }}
      />
      <Text71 variant="bodyLight14" color="textMuted" style={{ textAlign: 'center' }}>
        {SHEET_TEXT.emptyBefore}
        <Text71
          variant="bodyLight14"
          accessibilityRole="link"
          accessibilityLabel={SHEET_TEXT.manual}
          onPress={() => router.push('/gamebox/nova')}
          suppressHighlighting
          style={{ textDecorationLine: 'underline' }}
        >
          {SHEET_TEXT.manual}
        </Text71>
        {SHEET_TEXT.emptyAfter}
      </Text71>
      <PrimaryButton label={SHEET_TEXT.scan} onPress={() => router.push('/gamebox/ler')} />
    </View>
  );
}

function Pagination({ count, active }: { count: number; active: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`GameBox ${active + 1} de ${count}`}
      style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: layout.gameboxPaginationGap }}
    >
      {Array.from({ length: count }, (_, i) => {
        const on = i === active;
        const d = on ? layout.gameboxDotActive : layout.gameboxDotInactive;
        return (
          <View
            key={`dot-${i}`}
            testID={`pagination-dot-${i}`}
            style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: on ? colors.white : colors.surface20 }}
          />
        );
      })}
    </View>
  );
}

type Sheetable = { views: GameboxView[] } | { status: 'loading' } | { status: 'error' };

function useSheetState(uid: string): Sheetable {
  const boxes = useMyGameboxes(uid);
  const user = useMyUser(uid);
  const state = resolveGameboxList(boxes, user, uid);
  if (state.status === 'loading') return { status: 'loading' };
  if (state.status === 'error') return { status: 'error' };
  return { views: state.legacy ? [{ ...state.legacy, id: 'principal', order: 0 }] : state.list.map((d) => fromGameboxDoc(d, uid)) };
}

function Content({ state, onOpenTicket }: { state: Sheetable; onOpenTicket: (g: GameboxView) => void }) {
  const { width } = useWindowDimensions();
  const pageWidth = width - 2 * layout.sheetPadXOpen;
  const [page, setPage] = useState(0);

  if ('status' in state) {
    if (state.status === 'loading') return <View testID="gamebox-sheet-loading" style={{ minHeight: layout.gameboxQr }} />;
    return <Text71 variant="caption12" color="textMuted" style={{ textAlign: 'center' }}>{SHEET_TEXT.loadError}</Text71>;
  }
  const { views } = state;
  if (views.length === 0) return <Empty />;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    const p = Math.max(0, Math.min(views.length - 1, next));
    if (p !== page) haptic.light();
    setPage(p);
  };
  const active = Math.min(page, views.length - 1);
  const showHint = normalizeGameboxNumber(views[active]?.number ?? '') !== null;
  return (
    <View style={{ gap: layout.gameboxOpenGap }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={{ flexGrow: 0 }}>
        {views.map((g, i) => (
          <View key={g.id} testID="gamebox-page" style={{ width: pageWidth }}>
            <GameboxCard gamebox={g} index={i} onOpenTicket={onOpenTicket} />
          </View>
        ))}
      </ScrollView>
      {views.length > 1 ? <Pagination count={views.length} active={active} /> : null}
      {showHint ? (
        <Text71 variant="caption12" color="textSubtle" style={{ textAlign: 'center' }}>{CARD_TEXT.ticketHint}</Text71>
      ) : null}
    </View>
  );
}

export function HomeGameboxSheet({ uid, onOpenTicket }: { uid: string; onOpenTicket?: (gamebox: GameboxView) => void }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const { bottom } = useSafeAreaInsets();
  const collapsedHeight = useGameboxSheetCollapsedHeight();
  const state = useSheetState(uid);
  const empty = !('status' in state) && state.views.length === 0;
  const openHeight = empty ? layout.gameboxEmptyOpenHeight : layout.gameboxOpenHeight;
  const openTicket = onOpenTicket ?? ((g: GameboxView) => router.push(ticketHref(g.id)));
  return (
    <>
      {open ? (
        <Touchable
          testID="gamebox-scrim"
          accessibilityRole="button"
          accessibilityLabel={SHEET_TEXT.close}
          feedback="none"
          onPress={() => setOpen(false)}
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrimV71 }]}
        />
      ) : null}
      <Sheet
        title={SHEET_TEXT.title}
        tone={open ? 'night' : 'light'}
        collapsedHeight={collapsedHeight}
        expandedHeight={Math.max(collapsedHeight, Math.min(height, openHeight + Math.max(0, bottom - layout.homeIndicator)))}
        open={open}
        onOpenChange={(o) => {
          // 20/11: abrir a GameBox vibra ao de leve.
          if (o) haptic.light();
          setOpen(o);
        }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingTop: layout.gameboxOpenGap, paddingBottom: Math.max(bottom, space.s24) }}
        >
          <Content state={state} onOpenTicket={openTicket} />
        </ScrollView>
      </Sheet>
    </>
  );
}
