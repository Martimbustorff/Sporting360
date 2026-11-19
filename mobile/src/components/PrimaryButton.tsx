// Figma V7.1: botão 4919:5140 (Primário, Escuro, Contorno, Branco): altura 52, raio 26, etiqueta Title S 20.
// Contorno: 1.5 pt branco. O `secondary` antigo mapeia para `outline`.
import { ActivityIndicator, View } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { Text71 } from '@/theme/typography';
import { colors, layout } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'dark' | 'outline' | 'white' | 'secondary';

const LOOK = {
  primary: { bg: colors.primary, fg: 'white', border: undefined },
  dark: { bg: colors.ink, fg: 'white', border: undefined },
  outline: { bg: undefined, fg: 'white', border: colors.white },
  white: { bg: colors.white, fg: 'primary', border: undefined },
} as const;

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = loading || disabled;
  const look = LOOK[variant === 'secondary' ? 'outline' : variant];
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={{
        height: layout.buttonHeight,
        borderRadius: layout.buttonHeight / 2,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: look.bg,
        borderWidth: look.border ? layout.buttonOutline : undefined,
        borderColor: look.border,
        opacity: disabled ? layout.disabledOpacity : undefined,
      }}
    >
      {loading ? (
        <View testID="button-loading">
          <ActivityIndicator color={colors[look.fg]} />
        </View>
      ) : (
        <Text71 variant="titleS20" color={look.fg} numberOfLines={1}>
          {label}
        </Text71>
      )}
    </Touchable>
  );
}
