import { Text, type TextProps } from 'react-native';
import { colors, text71, type } from './tokens';

type DisplayVariant = 'screenTitle' | 'heroTitle' | 'menuItem' | 'minute' | 'sectionScore' | 'scoreBox' | 'rowScore' | 'tableHead' | 'tableValue' | 'tablePosition';
type BodyVariant = 'body' | 'strip' | 'sectionLabel' | 'tab' | 'badge' | 'badgeSmall' | 'rowTeam' | 'tableTeam' | 'standingsTeam';

export function Display({ variant, style, ...rest }: TextProps & { variant: DisplayVariant }) {
  return <Text {...rest} style={[type[variant], { textTransform: 'uppercase' }, style]} />;
}

export function Body({ variant, style, ...rest }: TextProps & { variant: BodyVariant }) {
  return <Text {...rest} style={[type[variant], style]} />;
}

export function Text71({ variant, color = 'white', style, ...rest }: TextProps & { variant: keyof typeof text71; color?: keyof typeof colors }) {
  return <Text {...rest} style={[text71[variant], { color: colors[color] }, style]} />;
}
