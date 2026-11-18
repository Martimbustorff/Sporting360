import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import { EventRow, type EventVM } from '@/components/EventRow';

const ev = (o: Partial<EventVM>): EventVM => ({ minute: '40’', side: 'home', kind: 'yellow', primary: 'Clabria D.', ...o });

describe('EventRow', () => {
  it('home: minute before the name', async () => {
    await render(<EventRow event={ev({})} />);
    const kids = screen.getByTestId('event-row').children as unknown as { props: { testID?: string } }[];
    const order = kids.map((c) => c.props.testID);
    expect(order.indexOf('event-minute')).toBeLessThan(order.indexOf('event-name'));
    expect(StyleSheet.flatten(screen.getByTestId('event-row').props.style).justifyContent).toBe('flex-start');
  });

  it('away: name before the minute, aligned right', async () => {
    await render(<EventRow event={ev({ side: 'away' })} />);
    const kids = screen.getByTestId('event-row').children as unknown as { props: { testID?: string } }[];
    const order = kids.map((c) => c.props.testID);
    expect(order.indexOf('event-name')).toBeLessThan(order.indexOf('event-minute'));
    expect(StyleSheet.flatten(screen.getByTestId('event-row').props.style).justifyContent).toBe('flex-end');
  });

  it('red card has accessibility label and red glyph', async () => {
    await render(<EventRow event={ev({ kind: 'red', primary: 'Pote' })} />);
    expect(screen.getByLabelText('Cartão vermelho')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('event-glyph').props.style).backgroundColor).toBe(colors.cardRed);
  });

  it('yellow card glyph uses the alternate yellow from the design', async () => {
    await render(<EventRow event={ev({})} />);
    expect(screen.getByLabelText('Cartão amarelo')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('event-glyph').props.style).backgroundColor).toBe(colors.cardYellowAlt);
  });

  it('labels the other kinds', async () => {
    await render(<EventRow event={ev({ kind: 'goal', primary: 'Gyökeres', secondary: 'Assist: Trincão' })} />);
    expect(screen.getByLabelText('Golo')).toBeTruthy();
    expect(screen.getByText('Assist: Trincão')).toBeTruthy();
  });

  it('sub and var labels', async () => {
    await render(<EventRow event={ev({ kind: 'sub' })} />);
    expect(screen.getByLabelText('Substituição')).toBeTruthy();
    await render(<EventRow event={ev({ kind: 'var' })} />);
    expect(screen.getByLabelText('VAR')).toBeTruthy();
  });

  it('missed penalty: own label and a red outline ball, not the goal glyph', async () => {
    await render(<EventRow event={ev({ kind: 'goal', primary: 'Gyökeres' })} />);
    const goalGlyph = screen.getByTestId('event-glyph').props.children;
    await render(<EventRow event={ev({ kind: 'missedPenalty', primary: 'Gyökeres', secondary: 'Penálti falhado' })} />);
    expect(screen.getByLabelText('Penálti falhado')).toBeTruthy();
    expect(screen.queryByLabelText('Golo')).toBeNull();
    const glyph = screen.getByTestId('event-glyph');
    expect(StyleSheet.flatten(glyph.props.style).color).toBe(colors.cardRed);
    expect(glyph.props.children).not.toEqual(goalGlyph);
  });
});
