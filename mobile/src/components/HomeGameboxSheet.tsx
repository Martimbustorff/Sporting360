// Figma: nó 564:6981 (folha GameBox recolhida, título "GameBox Digital"); na Home 1561:5164.
// Aberta com GameBox: 450:5419 (QR, nome e número, Estádio/Pavilhão, paginação 450:5562) e 348:40189 (só Estádio).
// Aberta sem GameBox: 348:39454 (botão verde "Digitalizar" com o ícone System/Camera 348:39561, descarregado do nó para
// assets/icons/camera.svg, e o texto com "insere manualmente" sublinhado).
// SEM FIGMA: esqueleto de carregamento e erro de leitura.
// Task 24: lê as GameBox do utilizador (useMyGameboxes) e mostra uma página por GameBox. Sem documentos e com número
// antigo em users/{uid}.gameboxNumber mostra-o como "Principal" (mesma regra da lista, resolveGameboxList).
import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { ScrollView, Text, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CARD_TEXT, GameboxCard } from '@/components/GameboxCard';
import { Sheet } from '@/components/Sheet';
import { Touchable } from '@/components/Touchable';
import { useMyUser } from '@/data/hooks';
import { useMyGameboxes } from '@/data/user';
import { fromGameboxDoc, resolveGameboxList, type GameboxView } from '@/lib/gamebox';
import { Display } from '@/theme/typography';
import { colors, layout, radius, spacing, type } from '@/theme/tokens';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const CAMERA = require('../../assets/icons/camera.svg');

export const SHEET_TEXT = {
  title: 'GameBox Digital',
  scan: 'Digitalizar',
  emptyBefore: 'Digitaliza o código de barras da tua Gamebox ou ',
  manual: 'insere manualmente',
  emptyAfter: ' o número.',
  loadError: 'Não foi possível carregar as tuas GameBox.',
  unreadable: CARD_TEXT.unreadable,
} as const;

/** Altura visível da folha recolhida: padding, linha do título e a zona do indicador home. */
export function useGameboxSheetCollapsedHeight(): number {
  const { bottom } = useSafeAreaInsets();
  return layout.sheetPadYCollapsed + layout.minTouch + Math.max(bottom, layout.homeIndicator);
}

function Empty() {
  const router = useRouter();
  return (
    <View style={{ gap: layout.gameboxSheetEmptyGap, alignItems: 'stretch' }}>
      <Touchable
        accessibilityRole="button"
        accessibilityLabel={SHEET_TEXT.scan}
        onPress={() => router.push('/gamebox/ler')}
        style={{
          height: layout.buttonHeight,
          borderRadius: radius.button,
          backgroundColor: colors.primary,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.sm,
        }}
      >
        <Image source={CAMERA} style={{ width: layout.headerIcon, height: layout.headerIcon }} accessible={false} />
        <Display variant="screenTitle" style={{ color: colors.white }}>
          {SHEET_TEXT.scan}
        </Display>
      </Touchable>
      <Text style={type.gameboxEmpty}>
        {SHEET_TEXT.emptyBefore}
        <Text
          accessibilityRole="link"
          accessibilityLabel={SHEET_TEXT.manual}
          onPress={() => router.push('/gamebox/nova')}
          suppressHighlighting
          style={type.gameboxEmptyLink}
        >
          {SHEET_TEXT.manual}
        </Text>
        {SHEET_TEXT.emptyAfter}
      </Text>
    </View>
  );
}

function Pagination({ count, active }: { count: number; active: number }) {
  return (
    <View
      accessible
      accessibilityLabel={`GameBox ${active + 1} de ${count}`}
      style={{ flexDirection: 'row', justifyContent: 'center', gap: layout.paginationGap }}
    >
      {Array.from({ length: count }, (_, i) => (
        <View
          key={`dot-${i}`}
          testID={`pagination-dot-${i}`}
          style={{
            width: layout.paginationDot,
            height: layout.paginationDot,
            borderRadius: layout.paginationDot / 2,
            backgroundColor: i === active ? colors.primary : colors.dotInactive,
          }}
        />
      ))}
    </View>
  );
}

function Content({ uid }: { uid: string }) {
  const boxes = useMyGameboxes(uid);
  const user = useMyUser(uid);
  const state = resolveGameboxList(boxes, user, uid);
  const { width } = useWindowDimensions();
  const pageWidth = width - 2 * layout.sheetPadXOpen;
  const [page, setPage] = useState(0);

  if (state.status === 'loading') return <View testID="gamebox-sheet-loading" style={{ minHeight: layout.gameboxQr }} />;
  if (state.status === 'error') {
    return (
      <Text style={[type.gameboxEmpty, { marginTop: spacing.lg }]}>{SHEET_TEXT.loadError}</Text>
    );
  }
  const views: GameboxView[] = state.legacy
    ? [{ ...state.legacy, id: 'principal', order: 0 }]
    : state.list.map((d) => fromGameboxDoc(d, uid));
  if (views.length === 0) return <Empty />;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (pageWidth <= 0) return;
    const next = Math.round(e.nativeEvent.contentOffset.x / pageWidth);
    setPage(Math.max(0, Math.min(views.length - 1, next)));
  };
  return (
    <View style={{ gap: layout.gameboxSheetGap }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={onScroll}
        style={{ flexGrow: 0 }}
      >
        {views.map((g, i) => (
          <View key={g.id} testID="gamebox-page" style={{ width: pageWidth }}>
            <GameboxCard gamebox={g} index={i} />
          </View>
        ))}
      </ScrollView>
      {views.length > 1 ? <Pagination count={views.length} active={Math.min(page, views.length - 1)} /> : null}
    </View>
  );
}

export function HomeGameboxSheet({ uid }: { uid: string }) {
  const [open, setOpen] = useState(false);
  const { height } = useWindowDimensions();
  const collapsedHeight = useGameboxSheetCollapsedHeight();
  return (
    <Sheet
      title={SHEET_TEXT.title}
      collapsedHeight={collapsedHeight}
      expandedHeight={Math.max(collapsedHeight, Math.round(height * layout.homeSheetExpandedRatio))}
      open={open}
      onOpenChange={setOpen}
    >
      <View style={{ paddingTop: layout.gameboxSheetGap }}>
        <Content uid={uid} />
      </View>
    </Sheet>
  );
}
