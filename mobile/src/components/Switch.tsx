// Figma V7.1: interruptor 4918:5108 (51x31, ligado primary, desligado surface-20, botão branco 27 com 2 de margem).
import { View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { colors, layout } from '@/theme/tokens';

/** Só o desenho (para linhas tocáveis que já são o interruptor). */
export function SwitchTrack({ value, testID = 'toggle-track' }: { value: boolean; testID?: string }) {
  return (
    <View
      testID={testID}
      style={{
        width: layout.toggleWidth,
        height: layout.toggleHeight,
        borderRadius: layout.toggleHeight / 2,
        backgroundColor: value ? colors.primary : colors.surface20,
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
  );
}

export function Switch({
  value,
  onValueChange,
  label,
  disabled = false,
}: {
  value: boolean;
  onValueChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <Touchable
      accessibilityRole="switch"
      accessibilityLabel={label}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      onPress={() => onValueChange(!value)}
      style={{ opacity: disabled ? layout.disabledOpacity : undefined }}
    >
      <SwitchTrack value={value} />
    </Touchable>
  );
}
