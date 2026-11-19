// SEM FIGMA: seletor de golos do Prognóstico (sem frame vetorial; referência nas imagens da página "Appstore S360").
// Composto com tokens: nome da equipa (body, uma linha com reticências), a caixa de resultado branca do GameHeader
// (Figma 655:31868) e botões redondos "-" e "+" com a área mínima de toque. Não passa de `max` nem desce de `min`.
import Feather from '@expo/vector-icons/Feather';
import { View } from 'react-native';
import { Touchable } from './Touchable';
import { ScoreBox } from '@/components/GameHeader';
import { Body } from '@/theme/typography';
import { colors, layout, spacing } from '@/theme/tokens';

function StepButton({ icon, label, disabled, onPress }: { icon: 'minus' | 'plus'; label: string; disabled: boolean; onPress: () => void }) {
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: layout.minTouch,
        height: layout.minTouch,
        borderRadius: layout.minTouch / 2,
        borderWidth: layout.fieldLineWidth,
        borderColor: colors.white,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: disabled ? layout.disabledOpacity : undefined,
      }}
    >
      <Feather name={icon} size={layout.headerIcon} color={colors.white} />
    </Touchable>
  );
}

export function Stepper({
  label,
  value,
  onChange,
  min = 0,
  max = 20,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  min?: number;
  max?: number;
}) {
  const canDown = value > min;
  const canUp = value < max;
  return (
    <View
      accessible={false}
      style={{ flex: 1, minWidth: 0, alignItems: 'center', gap: spacing.sm }}
    >
      <Body variant="body" numberOfLines={1} style={{ textAlign: 'center', maxWidth: '100%' }}>
        {label}
      </Body>
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
        <ScoreBox value={value} testID={`stepper-value-${label}`} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <StepButton icon="minus" label={`Menos um golo para ${label}`} disabled={!canDown} onPress={() => canDown && onChange(value - 1)} />
        <StepButton icon="plus" label={`Mais um golo para ${label}`} disabled={!canUp} onPress={() => canUp && onChange(value + 1)} />
      </View>
    </View>
  );
}
