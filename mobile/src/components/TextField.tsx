// Figma V7.1: Campo de texto 4939:7188: etiqueta Eyebrow 13 text-subtle por cima, valor Body 14 branco, linha de 2 pt primary-on-dark,
// erro Caption 12 por baixo. Sem foco e vazio, a linha fica fina e em separator (SEM FIGMA).
// Olho: o ativo ic_eye (564:6910) está vazio no Figma (sem vetores); usa-se Ionicons eye-outline / eye-off-outline tingido com token.
import { useState, type ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TextInput, View, type TextInputProps } from 'react-native';
import { Touchable } from '@/components/Touchable';
import { Text71 } from '@/theme/typography';
import { colors, layout, radii, space, text71 } from '@/theme/tokens';

export function TextField({
  label,
  value,
  onChangeText,
  secure = false,
  error,
  keyboardType,
  autoComplete,
  textContentType,
  autoCapitalize = 'none',
  autoCorrect = false,
  accessory,
  placeholder,
  helper,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  error?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
  autoCapitalize?: TextInputProps['autoCapitalize'];
  autoCorrect?: boolean;
  /** Ação à direita do valor (ex.: leitor da GameBox, Figma 327:15144). */
  accessory?: ReactNode;
  placeholder?: string;
  /** Dica por baixo da linha (Caption 12 text-subtle); um erro visível substitui-a. */
  helper?: string;
}) {
  const [hidden, setHidden] = useState(true);
  const [focused, setFocused] = useState(false);
  const filled = value.length > 0;
  const active = filled || focused;
  return (
    <View style={{ gap: space.s8 }}>
      <Text71 testID="field-label" variant="eyebrow13" color="textSubtle" numberOfLines={1}>
        {label}
      </Text71>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s8 }}>
        <TextInput
          style={[text71.body14, { flex: 1, minWidth: 0, color: colors.white, paddingVertical: 0 }]}
          accessibilityLabel={label}
          accessibilityHint={error}
          placeholder={placeholder}
          placeholderTextColor={colors.textSubtle}
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          secureTextEntry={secure && hidden}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
        />
        {secure ? (
          <Touchable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar password' : 'Esconder password'}
            onPress={() => setHidden((h) => !h)}
            style={{ width: layout.minTouch, height: layout.minTouch, justifyContent: 'center', alignItems: 'center' }}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={layout.fieldEye} color={colors.textMuted} />
          </Touchable>
        ) : null}
        {accessory}
      </View>
      <View
        testID="field-line"
        style={{
          height: active ? layout.fieldLineWidthActive : layout.fieldLineWidth,
          borderRadius: radii.r8,
          backgroundColor: active ? colors.primaryOnDark : colors.separator,
        }}
      />
      {error ? (
        <Text71 variant="caption12" color="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text71>
      ) : helper ? (
        <Text71 variant="caption12" color="textSubtle">
          {helper}
        </Text71>
      ) : null}
    </View>
  );
}
