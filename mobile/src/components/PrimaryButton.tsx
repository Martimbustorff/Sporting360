// Figma: nós 564:7259 ("Entrar") e 564:7261 ("Criar uma conta"): ambos fundo branco, raio 52, texto DIN 24 primary.
// SEM FIGMA (variante secondary): verificadas as páginas "Last Version S360" (22:1192) e "Calendário" (489:5623); não existe botão de contorno/secundário no Figma, ambos os botões são iguais. A validar pelo Martim.
import { ActivityIndicator, View } from 'react-native';
import { Touchable } from './Touchable';
import { Display } from '@/theme/typography';
import { colors, layout, radius } from '@/theme/tokens';

export function PrimaryButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
}) {
  const inactive = loading || disabled;
  const primary = variant === 'primary';
  return (
    <Touchable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      className={primary ? 'items-center justify-center bg-s360-white' : 'items-center justify-center border border-s360-white'}
      style={{
        height: layout.buttonHeight,
        borderRadius: radius.button,
        opacity: disabled ? layout.disabledOpacity : undefined,
      }}
    >
      {loading ? (
        <View testID="button-loading">
          <ActivityIndicator color={primary ? colors.primary : colors.white} />
        </View>
      ) : (
        <Display variant="screenTitle" style={primary ? undefined : { color: colors.white }}>
          {label}
        </Display>
      )}
    </Touchable>
  );
}
