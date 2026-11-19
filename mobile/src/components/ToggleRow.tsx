// Figma V7.1: List row 4919:5133 com trailing Interruptor ligado / desligado (Switch 4918:5108).
import type { ReactNode } from 'react';
import { ListRow, type ListRowSize } from '@/components/ListRow';
import { SwitchTrack } from '@/components/Switch';

export function ToggleRow({
  icon,
  label,
  value,
  onChange,
  disabled = false,
  size = 'L',
  separator = true,
}: {
  icon: ReactNode;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  size?: ListRowSize;
  separator?: boolean;
}) {
  return (
    <ListRow
      icon={icon}
      label={label}
      size={size}
      separator={separator}
      disabled={disabled}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      trailing={<SwitchTrack value={value} />}
    />
  );
}
