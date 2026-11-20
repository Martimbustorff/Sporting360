// 20/11 (Martim): "fazer swipe no ecrã" para passar entre separadores (Sumário, Vídeos, Estatísticas...).
// Envolve o conteúdo do separador ativo: um arrasto horizontal (o vertical continua a ser scroll) leva o conteúdo atrás
// do dedo e, passado `SWIPE.distance` ou num gesto rápido, muda para o separador ao lado; o novo entra a deslizar desse
// lado. Nas pontas resiste e volta. Toque leve (seleção) ao mudar. Sem Reanimated (testes) é só o conteúdo.
import type { ReactNode } from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { SlideInLeft, SlideInRight, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { haptic } from '@/lib/haptics';
import { canAnimate, MOTION, SPRING } from '@/lib/motion';
import { dragOffset, resolveSwipe, SWIPE } from '@/lib/swipeTabs';

export function SwipeTabs<K extends string>({
  keys,
  value,
  onChange,
  children,
  testID = 'swipe-tabs',
  slide = true,
}: {
  keys: readonly K[];
  value: K;
  onChange: (k: K) => void;
  children: ReactNode;
  testID?: string;
  /**
   * `false` quando o conteúdo também leva coisas que não mudam com o separador (Calendário: o cartão do próximo jogo e
   * a escolha Próximos/Resultados estão dentro da lista): o gesto muda de separador sem mexer o conteúdo.
   */
  slide?: boolean;
}) {
  if (!canAnimate()) return <View testID={testID} style={{ flex: 1 }}>{children}</View>;
  return (
    <Swipe keys={keys} value={value} onChange={onChange} testID={testID} slide={slide}>
      {children}
    </Swipe>
  );
}

function Swipe<K extends string>({ keys, value, onChange, children, testID, slide }: { keys: readonly K[]; value: K; onChange: (k: K) => void; children: ReactNode; testID: string; slide: boolean }) {
  const index = Math.max(0, keys.indexOf(value));
  const count = keys.length;
  const x = useSharedValue(0);
  // Lado de onde entra o separador novo: 1 = da direita (veio do seguinte), -1 = da esquerda.
  const [from, setFrom] = useState<1 | -1>(1);

  const go = (next: number) => {
    const k = keys[next];
    if (k === undefined || next === index) return;
    setFrom(next > index ? 1 : -1);
    haptic.selection();
    onChange(k);
  };

  const pan = Gesture.Pan()
    .activeOffsetX([-SWIPE.activeX, SWIPE.activeX])
    .failOffsetY([-SWIPE.failY, SWIPE.failY])
    .onUpdate((e) => {
      'worklet';
      if (slide) x.set(dragOffset({ dx: e.translationX, index, count }));
    })
    .onEnd((e) => {
      'worklet';
      const next = resolveSwipe({ dx: e.translationX, vx: e.velocityX, index, count });
      x.set(withSpring(0, SPRING));
      if (next !== index) scheduleOnRN(go, next);
    });

  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  const entering = (from === 1 ? SlideInRight : SlideInLeft).duration(MOTION.base);

  return (
    <GestureDetector gesture={pan}>
      <Animated.View testID={testID} style={[{ flex: 1, overflow: 'hidden' }, style]}>
        {slide ? (
          <Animated.View key={value} entering={entering} style={{ flex: 1 }}>
            {children}
          </Animated.View>
        ) : (
          children
        )}
      </Animated.View>
    </GestureDetector>
  );
}
