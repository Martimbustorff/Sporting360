// Figma V7.1: Prognóstico (4945:8059 "Golos · SPORTING"): linha em surface-06, raio 16, padding 12 12 12 16, gap 12:
// emblema 30x35, nome Label 16 (uma linha, reticências), "−" e "+" em círculos de 44 (surface-10, Title 24) e a caixa
// branca 52x60 raio 8 com o valor em Display 40 ink. Submetido (4946:8064): a mesma linha só com emblema, nome e caixa.
// Abaixo de `layout.stepCompactBelow` de largura de janela (320 pt) o emblema esconde-se e o espaço desce para 8, para o
// nome ter pelo menos ~80 pt (uma linha, reticências). Não passa de `max` nem desce de `min`.
// Movimento (20/11): no seletor, o número novo entra a descer (+) ou a subir (−) e o toque vibra ao de leve; no cartão
// de partilha (imagem) não há animação.
import { useRef, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp, LayoutAnimationConfig } from 'react-native-reanimated';
import { Touchable } from '@/components/Touchable';
import { haptic } from '@/lib/haptics';
import { canAnimate, MOTION } from '@/lib/motion';
import { Text71 } from '@/theme/typography';
import { colors, layout, space } from '@/theme/tokens';

/** Caixa branca do valor: seletor do Prognóstico (52x60), cartão de partilha (48x58) e a minha história (58x72, Score 56). */
export function ValueBox({ value, testID, size = 'step' }: { value: number; testID: string; size?: 'step' | 'share' | 'story' }) {
  const share = size !== 'step';
  const story = size === 'story';
  const box = story ? layout.storyBox : share ? layout.shareBox : layout.stepValue;
  return (
    <View
      style={{
        width: box.width,
        height: box.height,
        backgroundColor: colors.white,
        borderRadius: story ? layout.storyBoxRadius : share ? layout.shareBoxRadius : layout.stepValueRadius,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* A DIN Condensed reserva espaço de descendente por baixo: sem o ajuste os algarismos ficavam acima do centro
          da caixa branca (visto na partilha a 20/11). */}
      <Rolling value={value} animate={!share}>
        <Text71 variant={story ? 'score56' : 'display40'} color="ink" testID={testID} style={{ transform: [{ translateY: layout.valueDigitNudge }] }}>
          {value}
        </Text71>
      </Rolling>
    </View>
  );
}

function Rolling({ value, animate, children }: { value: number; animate: boolean; children: ReactNode }) {
  const prev = useRef(value);
  const up = value >= prev.current;
  prev.current = value;
  if (!animate || !canAnimate()) return <>{children}</>;
  return (
    <LayoutAnimationConfig skipEntering>
      <Animated.View key={value} entering={(up ? FadeInDown : FadeInUp).duration(MOTION.fast)}>
        {children}
      </Animated.View>
    </LayoutAnimationConfig>
  );
}

function StepButton({ glyph, label, disabled, onPress }: { glyph: '−' | '+'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={() => {
        haptic.selection();
        onPress();
      }}
      style={{
        width: layout.minTouch,
        height: layout.minTouch,
        borderRadius: layout.minTouch / 2,
        backgroundColor: colors.surface10,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? layout.disabledOpacity : undefined,
      }}
    >
      <Text71 variant="title24" accessibilityElementsHidden importantForAccessibility="no">
        {glyph}
      </Text71>
    </Touchable>
  );
}

export function Stepper({
  label,
  crest,
  value,
  onChange,
  min = 0,
  max = 20,
  readOnly = false,
}: {
  label: string;
  crest?: ReactNode;
  value: number;
  onChange?: (n: number) => void;
  min?: number;
  max?: number;
  /** Submetido: sem botões, só emblema, nome e caixa com o valor. */
  readOnly?: boolean;
}) {
  const compact = useWindowDimensions().width < layout.stepCompactBelow;
  const canDown = value > min;
  const canUp = value < max;
  const box = <ValueBox value={value} testID={`stepper-value-${label}`} />;
  return (
    <View
      accessible={false}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: compact ? space.s8 : layout.stepRowGap,
        backgroundColor: colors.surface06,
        borderRadius: layout.stepRowRadius,
        paddingLeft: layout.stepRowPadLeft,
        paddingRight: layout.stepRowPadRight,
        paddingVertical: layout.stepRowPadY,
      }}
    >
      {compact ? null : crest}
      <Text71 variant="label16" numberOfLines={1} style={{ flex: 1, minWidth: 0 }}>
        {label}
      </Text71>
      {readOnly || !onChange ? (
        box
      ) : (
        <>
          <StepButton glyph="−" label={`Menos um golo para ${label}`} disabled={!canDown} onPress={() => canDown && onChange(value - 1)} />
          <View
            accessible
            accessibilityRole="adjustable"
            accessibilityLabel={label}
            accessibilityValue={{ min, max, now: value }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(e) => {
              if (e.nativeEvent.actionName === 'increment' && canUp) onChange(value + 1);
              if (e.nativeEvent.actionName === 'decrement' && canDown) onChange(value - 1);
            }}
          >
            {box}
          </View>
          <StepButton glyph="+" label={`Mais um golo para ${label}`} disabled={!canUp} onPress={() => canUp && onChange(value + 1)} />
        </>
      )}
    </View>
  );
}
