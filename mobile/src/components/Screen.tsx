// SEM FIGMA: container de ecrã (fundo, safe area, padding horizontal). Compõe tokens.
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
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
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: 'match' | 'wide' | 'none';
  edges?: Edge[];
}) {
  const paddingHorizontal = PAD[padded];
  return (
    <SafeAreaView className="flex-1 bg-s360-bg" edges={edges}>
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
