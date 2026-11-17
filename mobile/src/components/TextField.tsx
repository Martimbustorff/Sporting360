// Figma: nós 564:6907 (vazio: etiqueta display 18 como placeholder, linha 1px branca a 30%) e 564:6938 (preenchido: etiqueta display 14 a 50%, valor corpo 16, linha 2px primary).
// SEM FIGMA (olho): o ativo ic_eye (564:6910) está vazio no Figma (sem vetores), por isso o alternador mantém o texto "Ver"/"Ocultar" até haver ícone.
import { useState } from 'react';
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
            <Body variant="strip" style={{ color: colors.textMuted }}>{hidden ? 'Ver' : 'Ocultar'}</Body>
          </Pressable>
        ) : null}
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
