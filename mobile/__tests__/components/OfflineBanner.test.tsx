import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { OfflineBanner } from '@/components/OfflineBanner';
import { EmptyState } from '@/components/EmptyState';

describe('OfflineBanner', () => {
  it('shows the offline text when visible', async () => {
    await render(<OfflineBanner visible />);
    expect(screen.getByText('Sem ligação. A mostrar os últimos dados guardados.')).toBeTruthy();
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
