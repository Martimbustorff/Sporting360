// Figma: nó 655:31905 ("1ª Parte" + "0-0": surface10, raio 8, padding 16/8, etiqueta sectionLabel, valor sectionScore)
// e 655:31960 (linha de informação "Árbitro" / valor, padding horizontal 16, sem fundo).
import { View } from 'react-native';
import { Body, Display } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

export function SectionBar({ label, right }: { label: string; right?: string }) {
  return (
    <View
      testID="section-bar"
      style={{
        backgroundColor: colors.surface10,
        borderRadius: radius.md,
        paddingHorizontal: spacing.md,
        paddingVertical: spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Body variant="sectionLabel" accessibilityRole="header">{label}</Body>
      {right ? (
        <Display variant="sectionScore" testID="section-bar-right">{right}</Display>
      ) : null}
    </View>
  );
}

/** `singleLine`: o valor fica numa linha com reticências (Perfil: jogador favorito, lugar anual). */
export function InfoRow({ label, value, singleLine = false }: { label: string; value: string; singleLine?: boolean }) {
  return (
    <View
      style={{
        minHeight: layout.minTouch,
        paddingHorizontal: spacing.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.md,
      }}
    >
      <Display variant="minute" style={singleLine ? { flexShrink: 0 } : undefined}>{label}</Display>
      <Body
        variant="body"
        numberOfLines={singleLine ? 1 : undefined}
        ellipsizeMode={singleLine ? 'tail' : undefined}
        style={{ flexShrink: 1, textAlign: 'right' }}
      >
        {value}
      </Body>
    </View>
  );
}
