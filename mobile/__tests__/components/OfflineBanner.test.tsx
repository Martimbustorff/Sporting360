import React from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import { OFFLINE_GRACE_MS, OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState } from '@/components/EmptyState';

describe('OfflineBanner', () => {
  it('shows the offline text when visible', async () => {
    await render(<OfflineBanner visible />);
    expect(await screen.findByText('Sem ligação. A mostrar os últimos dados guardados.', {}, { timeout: OFFLINE_GRACE_MS + 1000 })).toBeTruthy();
  });

  it('não aparece logo: a primeira leitura vem sempre da cache e o servidor confirma em menos de um segundo', async () => {
    jest.useFakeTimers();
    try {
      const view = await render(<OfflineBanner visible />);
      expect(screen.queryByTestId('offline-banner')).toBeNull();
      // O servidor confirma antes do fim da tolerância: o aviso nunca chega a aparecer (nada salta no ecrã).
      await act(async () => jest.advanceTimersByTime(OFFLINE_GRACE_MS - 100));
      await view.rerender(<OfflineBanner visible={false} />);
      await act(async () => jest.advanceTimersByTime(OFFLINE_GRACE_MS));
      expect(screen.queryByTestId('offline-banner')).toBeNull();
      // Continua sem servidor: aparece passada a tolerância.
      await view.rerender(<OfflineBanner visible />);
      await act(async () => jest.advanceTimersByTime(OFFLINE_GRACE_MS));
      expect(screen.getByTestId('offline-banner')).toBeTruthy();
      // E sai logo que os dados do servidor chegam.
      await view.rerender(<OfflineBanner visible={false} />);
      expect(screen.queryByTestId('offline-banner')).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('uses surface-20 and a Caption 12 white text (Figma 4952:9047)', async () => {
    await render(<OfflineBanner visible />);
    await screen.findByTestId('offline-banner', {}, { timeout: OFFLINE_GRACE_MS + 1000 });
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

  it('o ícone info tem 64 pt (Figma 47, 4952:9060)', async () => {
    await render(<EmptyState text="Sem dados." icon="info" />);
    const style = StyleSheet.flatten(screen.getByTestId('empty-icon-info').props.style);
    expect(style.width).toBe(64);
    expect(style.height).toBe(64);
  });
});
