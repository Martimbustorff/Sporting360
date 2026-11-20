// SEM FIGMA: container de ecrã (fundo, safe area, padding horizontal). Compõe tokens.
// 20/11: o fundo leva o círculo da marca (BrandBackdrop) em todos os ecrãs; `backdrop={false}` só no bilhete da GameBox
// (o QR na entrada tem de ler bem). A Home não usa este container.
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { BrandBackdrop } from '@/components/BrandBackdrop';
import { spacing } from '@/theme/tokens';

// Header owns the top inset (it renders under the status bar), so by default Screen
// only applies bottom/left/right. A screen WITHOUT a Header must pass
// edges={['top','bottom','left','right']}.
const DEFAULT_EDGES: Edge[] = ['bottom', 'left', 'right'];

const PAD = { match: spacing.screenX, wide: spacing.screenXWide, none: 0 } as const;

export function Screen({
  children,
  scroll = false,
  padded = 'match',
  edges = DEFAULT_EDGES,
  backdrop = true,
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: 'match' | 'wide' | 'none';
  edges?: Edge[];
  backdrop?: boolean;
}) {
  const paddingHorizontal = PAD[padded];
  return (
    <SafeAreaView className="flex-1 bg-s360-bg" edges={edges}>
      {backdrop ? <BrandBackdrop /> : null}
      {scroll ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal }}>{children}</ScrollView>
      ) : (
        <View className="flex-1" style={{ paddingHorizontal }}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
