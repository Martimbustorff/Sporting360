import { Text, type TextProps } from 'react-native';
import { type } from './tokens';

type DisplayVariant = 'screenTitle' | 'heroTitle' | 'menuItem' | 'minute' | 'sectionScore' | 'scoreBox';
type BodyVariant = 'body' | 'strip' | 'sectionLabel' | 'tab' | 'badge' | 'badgeSmall';

export function Display({ variant, style, ...rest }: TextProps & { variant: DisplayVariant }) {
  return <Text {...rest} style={[type[variant], { textTransform: 'uppercase' }, style]} />;
}

export function Body({ variant, style, ...rest }: TextProps & { variant: BodyVariant }) {
  return <Text {...rest} style={[type[variant], style]} />;
}
