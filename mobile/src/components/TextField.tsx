// Figma: nós 564:6907 (vazio: etiqueta display 18 como placeholder, linha 1px branca a 30%) e 564:6938 (preenchido: etiqueta display 14 a 50%, valor corpo 16, linha 2px primary).
// Olho: o ativo ic_eye (564:6910) está vazio no Figma (sem vetores); usa-se Ionicons eye-outline / eye-off-outline tingido com token.
import { useState, type ReactNode } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, TextInput, View, type TextInputProps } from 'react-native';
import { Body } from '@/theme/typography';
import { colors, layout, radius, spacing, type } from '@/theme/tokens';

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
}) {
  const [hidden, setHidden] = useState(true);
  const filled = value.length > 0;
  return (
    <View>
      {filled ? (
        <Text
          testID="field-label"
          style={[type.fieldLabel, { opacity: layout.fieldLabelOpacity, marginBottom: spacing.sm }]}
        >
          {label}
        </Text>
      ) : null}
      <View className="flex-row items-center" style={{ gap: spacing.sm }}>
        <TextInput
          className="flex-1"
          style={[filled ? type.fieldValue : type.fieldPlaceholder, { paddingVertical: spacing.sm }]}
          accessibilityLabel={label}
          accessibilityHint={error}
          placeholder={label.toLocaleUpperCase('pt-PT')}
          placeholderTextColor={colors.white}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && hidden}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar password' : 'Esconder password'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
            style={{ minHeight: layout.minTouch, minWidth: layout.minTouch, justifyContent: 'center', alignItems: 'center' }}
          >
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={layout.headerIcon} color={colors.textMuted} />
          </Pressable>
        ) : null}
        {accessory}
      </View>
      <View
        testID="field-line"
        style={{
          marginTop: filled ? layout.fieldGapFilled : layout.fieldGapEmpty,
          height: filled ? layout.fieldLineWidthActive : layout.fieldLineWidth,
          borderRadius: radius.line,
          backgroundColor: filled ? colors.primary : colors.white,
          opacity: filled ? 1 : layout.fieldLineOpacity,
        }}
      />
      {error ? (
        <Body variant="body" accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.cardRed }}>
          {error}
        </Body>
      ) : null}
    </View>
  );
}
