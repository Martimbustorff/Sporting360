// Figma: nós 500:29054 (grande, "J16": preenchimento primary, raio 16, padding 8/4, texto semibold 14),
// 500:28830 (pequeno: padding 6/2, 12px) e 500:28917 ("Liga Europa", pequeno).
import { View } from 'react-native';
import { formatRound } from '@/lib/formatRound';
import { Body } from '@/theme/typography';
import { colors, layout, radius, spacing } from '@/theme/tokens';

export function CompetitionBadge({ label, size }: { label: string; size: 'lg' | 'sm' }) {
  const text = formatRound(label);
  if (!text) return null;
  const lg = size === 'lg';
  return (
    <View
      testID="competition-badge"
      style={{
        backgroundColor: colors.primary,
        borderRadius: radius.pill,
        paddingHorizontal: lg ? spacing.sm : layout.badgeSmallPadX,
        paddingVertical: lg ? spacing.xs : layout.badgeSmallPadY,
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
      }}
    >
      <Body variant={lg ? 'badge' : 'badgeSmall'}>{text}</Body>
    </View>
  );
}
