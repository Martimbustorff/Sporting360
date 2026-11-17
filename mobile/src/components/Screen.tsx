// SEM FIGMA: container de ecrã (fundo, safe area, padding horizontal). Compõe tokens.
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { spacing } from '@/theme/tokens';

const PAD = { match: spacing.screenX, wide: spacing.screenXWide, none: 0 } as const;

export function Screen({
  children,
  scroll = false,
  padded = 'match',
}: {
  children: ReactNode;
  scroll?: boolean;
  padded?: 'match' | 'wide' | 'none';
}) {
  const paddingHorizontal = PAD[padded];
  return (
    <SafeAreaView className="flex-1 bg-s360-bg">
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
