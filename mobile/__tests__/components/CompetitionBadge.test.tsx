import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors, layout, radius, spacing } from '@/theme/tokens';
import { CompetitionBadge } from '@/components/CompetitionBadge';

describe('CompetitionBadge', () => {
  it('translates the round label', async () => {
    await render(<CompetitionBadge label="Round of 16" size="lg" />);
    expect(screen.getByText('Oitavos de final')).toBeTruthy();
  });
  it('shows matchday as J16', async () => {
    await render(<CompetitionBadge label="Regular Season - 16" size="lg" />);
    expect(screen.getByText('J16')).toBeTruthy();
  });
  it('lg: primary pill, 14px, padding 8/4', async () => {
    await render(<CompetitionBadge label="J16" size="lg" />);
    const box = StyleSheet.flatten(screen.getByTestId('competition-badge').props.style);
    expect(box.backgroundColor).toBe(colors.primary);
    expect(box.borderRadius).toBe(radius.pill);
    expect(box.paddingHorizontal).toBe(spacing.sm);
    expect(box.paddingVertical).toBe(spacing.xs);
    expect(StyleSheet.flatten(screen.getByText('J16').props.style).fontSize).toBe(14);
  });
  it('sm: 12px, padding 6/2', async () => {
    await render(<CompetitionBadge label="Liga Europa" size="sm" />);
    const box = StyleSheet.flatten(screen.getByTestId('competition-badge').props.style);
    expect(box.paddingHorizontal).toBe(layout.badgeSmallPadX);
    expect(box.paddingVertical).toBe(layout.badgeSmallPadY);
    expect(StyleSheet.flatten(screen.getByText('Liga Europa').props.style).fontSize).toBe(12);
  });
});
