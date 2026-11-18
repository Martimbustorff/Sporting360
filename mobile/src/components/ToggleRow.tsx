// Figma: nós 323:11790 (linha "Notificações": ícone 24, gap 16, etiqueta DIN 18 maiúsculas, interruptor à direita)
// e 306:6426 (interruptor ligado 51x31, verde, botão branco 27 com 2 de margem). Reutilizado nas Definições (Task 26).
// SEM FIGMA (estado desligado e sombra do botão): trilho surface20, botão à esquerda; sem sombra (só tokens).
// Separador `divider` abaixo, como em MenuRow.
import type { ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { colors, layout, radius, spacing, type } from '@/theme/tokens';

export function ToggleRow({
  icon,
  label,
  value,
  onChange,
  disabled = false,
}: {
  icon: ReactNode;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onChange(!value)}
      style={({ pressed }) => ({
        minHeight: layout.minTouch,
        paddingVertical: spacing.sm,
        borderBottomWidth: layout.fieldLineWidth,
        borderBottomColor: colors.divider,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        opacity: disabled ? layout.disabledOpacity : pressed ? layout.pressedOpacity : 1,
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: layout.menuRowGap, flexShrink: 1 }}>
        <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>{icon}</View>
        <Text style={type.menuRow} numberOfLines={1}>{label}</Text>
      </View>
      <View
        testID="toggle-track"
        style={{
          width: layout.toggleWidth,
          height: layout.toggleHeight,
          borderRadius: radius.button,
          backgroundColor: value ? colors.toggleOn : colors.surface20,
          paddingHorizontal: layout.toggleInset,
          justifyContent: 'center',
          alignItems: value ? 'flex-end' : 'flex-start',
        }}
      >
        <View
          style={{
            width: layout.toggleKnob,
            height: layout.toggleKnob,
            borderRadius: layout.toggleKnob / 2,
            backgroundColor: colors.white,
          }}
        />
      </View>
    </Pressable>
  );
}
