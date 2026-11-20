// Movimento (20/11): conteúdo que acaba de chegar aparece com um fade curto (`MOTION.base`) em vez de trocar de repente.
// Só anima ao montar: uma atualização dos dados (mesma árvore) não volta a animar. Sem Reanimated é uma View simples.
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { canAnimate, MOTION } from '@/lib/motion';

export function Appear({
  children,
  style,
  from = 'fade',
  testID,
  pointerEvents,
}: {
  children: ReactNode;
  pointerEvents?: 'box-none' | 'auto';
  style?: StyleProp<ViewStyle>;
  /** 'fade' (conteúdo de um ecrã) ou 'below' (lance novo, linha nova: entra a subir um pouco). */
  from?: 'fade' | 'below';
  testID?: string;
}) {
  if (!canAnimate()) return <View style={style} testID={testID} pointerEvents={pointerEvents}>{children}</View>;
  const entering = from === 'below' ? FadeInDown.duration(MOTION.base) : FadeIn.duration(MOTION.base);
  return (
    <Animated.View entering={entering} style={style} testID={testID} pointerEvents={pointerEvents}>
      {children}
    </Animated.View>
  );
}
