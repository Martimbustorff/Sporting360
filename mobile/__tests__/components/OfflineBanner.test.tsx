import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState } from '@/components/EmptyState';

describe('OfflineBanner', () => {
  it('shows the offline text when visible', async () => {
    await render(<OfflineBanner visible />);
    expect(screen.getByText('Sem ligação. A mostrar os últimos dados guardados.')).toBeTruthy();
  });

  it('uses surface-20 and a Caption 12 white text (Figma 4952:9047)', async () => {
    await render(<OfflineBanner visible />);
    expect(StyleSheet.flatten(screen.getByTestId('offline-banner').props.style).backgroundColor).toBe(colors.surface20);
    const t = StyleSheet.flatten(screen.getByText(/Sem ligação/).props.style);
    expect(t.fontSize).toBe(12);
    expect(t.color).toBe(colors.white);
  });

  it('renders nothing when not visible', async () => {
    const view = await render(<OfflineBanner visible={false} />);
    expect(view.toJSON()).toBeNull();
  });
});

describe('EmptyState', () => {
  it('shows the text and the calendar icon by default', async () => {
    await render(<EmptyState text="Sem jogos marcados." />);
    expect(screen.getByText('Sem jogos marcados.')).toBeTruthy();
    expect(screen.getByTestId('empty-icon-calendar')).toBeTruthy();
  });

  it('can show the info icon', async () => {
    await render(<EmptyState text="Sem dados." icon="info" />);
    expect(screen.getByTestId('empty-icon-info')).toBeTruthy();
  });
});
