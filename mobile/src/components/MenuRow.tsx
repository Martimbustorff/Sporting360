// Figma V7.1: List row 4919:5133 (trailing Seta / Externa / Nenhum, tamanho L 64 / M 52, separador opcional).
import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { ListRow, type ListRowSize } from '@/components/ListRow';
import { colors, layout } from '@/theme/tokens';

export function MenuRow({
  icon,
  label,
  onPress,
  external = false,
  size = 'L',
  separator = true,
  trailing = external ? 'external' : 'arrow',
}: {
  icon: ReactNode;
  label: string;
  onPress: () => void;
  external?: boolean;
  size?: ListRowSize;
  separator?: boolean;
  trailing?: 'arrow' | 'external' | 'none';
}) {
  return (
    <ListRow
      icon={icon}
      label={label}
      size={size}
      separator={separator}
      onPress={onPress}
      accessibilityRole={external ? 'link' : 'button'}
      trailing={
        trailing === 'none' ? null : (
          <Feather
            name={trailing === 'external' ? 'arrow-up-right' : 'arrow-right'}
            size={layout.menuRowIcon}
            color={colors.white}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        )
      }
    />
  );
}
