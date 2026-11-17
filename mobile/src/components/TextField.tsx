// Figma: nós 564:6907 (vazio, com olho) e 564:6938 (preenchido, com etiqueta): NÃO consultados (limite de chamadas do MCP Figma atingido).
// SEM FIGMA (provisório): composto com tokens; rever contra os dois nós quando o limite repuser.
import { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';
import { Body } from '@/theme/typography';
import { colors, spacing } from '@/theme/tokens';

export function TextField({
  label,
  value,
  onChangeText,
  secure = false,
  error,
  keyboardType,
  autoComplete,
  textContentType,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  secure?: boolean;
  error?: string;
  keyboardType?: TextInputProps['keyboardType'];
  autoComplete?: TextInputProps['autoComplete'];
  textContentType?: TextInputProps['textContentType'];
}) {
  const [hidden, setHidden] = useState(true);
  return (
    <View>
      {value ? <Body variant="sectionLabel" style={{ color: colors.textMuted }}>{label}</Body> : null}
      <View className="flex-row items-center border-b border-s360-divider" style={{ gap: spacing.sm }}>
        <TextInput
          className="flex-1 py-2 text-s360-white font-body text-[14px]"
          accessibilityLabel={label}
          accessibilityHint={error}
          placeholder={label}
          placeholderTextColor={colors.textDisabled}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secure && hidden}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          textContentType={textContentType}
          autoCapitalize="none"
        />
        {secure ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={hidden ? 'Mostrar password' : 'Esconder password'}
            onPress={() => setHidden((h) => !h)}
            hitSlop={12}
          >
            <Body variant="strip" style={{ color: colors.textMuted }}>{hidden ? 'Ver' : 'Ocultar'}</Body>
          </Pressable>
        ) : null}
      </View>
      {error ? <Body variant="body" style={{ color: colors.cardRed }}>{error}</Body> : null}
    </View>
  );
}
