import { StyleSheet } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PlayerPhoto } from '@/components/PlayerPhoto';

describe('PlayerPhoto: forma', () => {
  it('círculo por defeito (raio = metade)', async () => {
    await render(<PlayerPhoto photo={null} size={40} testID="p" />);
    const inner = screen.getByTestId('p').children[0] as unknown as { props: { style: object } };
    expect(StyleSheet.flatten(inner.props.style)).toMatchObject({ borderRadius: 20 });
  });

  it('rounded: quadrado de cantos de 20 também a 84 pt', async () => {
    await render(<PlayerPhoto photo={null} size={84} shape="rounded" testID="p" />);
    const inner = screen.getByTestId('p').children[0] as unknown as { props: { style: object } };
    expect(StyleSheet.flatten(inner.props.style)).toMatchObject({ width: 84, height: 84, borderRadius: 20 });
  });
});

describe('PlayerPhoto', () => {
  it('shows the silhouette when photo is null', async () => {
    await render(<PlayerPhoto photo={null} size={40} />);
    expect(screen.getByTestId('player-silhouette')).toBeTruthy();
    expect(screen.queryByTestId('player-photo-image', { hidden: true })).toBeNull();
  });

  it('shows the image when there is a photo', async () => {
    await render(<PlayerPhoto photo="https://x/p.png" size={40} />);
    expect(screen.getByTestId('player-photo-image', { hidden: true })).toBeTruthy();
    expect(screen.queryByTestId('player-silhouette')).toBeNull();
  });

  it('falls back to the silhouette when the image fails to load', async () => {
    await render(<PlayerPhoto photo="https://x/broken.png" size={40} />);
    await fireEvent(screen.getByTestId('player-photo-image', { hidden: true }), 'error', { nativeEvent: { error: 'x' } });
    expect(screen.getByTestId('player-silhouette')).toBeTruthy();
  });

  it('number badge only when number is given', async () => {
    const r = await render(<PlayerPhoto photo={null} size={40} />);
    expect(screen.queryByTestId('player-number')).toBeNull();
    await r.unmount();
    await render(<PlayerPhoto photo={null} size={40} number={17} />);
    expect(screen.getByText('17')).toBeTruthy();
    expect(screen.getByTestId('player-number')).toBeTruthy();
  });

  it('number 0 still shows a badge, null does not', async () => {
    const r = await render(<PlayerPhoto photo={null} size={40} number={0} />);
    expect(screen.getByText('0')).toBeTruthy();
    await r.unmount();
    await render(<PlayerPhoto photo={null} size={40} number={null} />);
    expect(screen.queryByTestId('player-number')).toBeNull();
  });
});
