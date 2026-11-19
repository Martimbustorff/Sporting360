import { render, screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme/tokens';
import { EventRow, type EventVM } from '@/components/EventRow';

const ev = (o: Partial<EventVM>): EventVM => ({ minute: '40’', side: 'sporting', kind: 'yellow', primary: 'Clabria D.', ...o });

describe('EventRow', () => {
  it('Sporting: name in the left column (aligned right), opponent column empty', async () => {
    await render(<EventRow event={ev({})} />);
    expect(within(screen.getByTestId('event-left')).getByText('Clabria D.')).toBeTruthy();
    expect(within(screen.getByTestId('event-right')).queryByText('Clabria D.')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('event-left').props.style).alignItems).toBe('flex-end');
  });

  it('opponent: name in the right column (aligned left)', async () => {
    await render(<EventRow event={ev({ side: 'opponent' })} />);
    expect(within(screen.getByTestId('event-right')).getByText('Clabria D.')).toBeTruthy();
    expect(within(screen.getByTestId('event-left')).queryByText('Clabria D.')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('event-right').props.style).alignItems).toBe('flex-start');
  });

  it('the minute sits in the centre box, between the two columns, on surface-10', async () => {
    await render(<EventRow event={ev({ minute: '90+2’' })} />);
    const kids = screen.getByTestId('event-row').children as unknown as { props: { testID?: string } }[];
    expect(kids.map((c) => c.props.testID)).toEqual(['event-left', 'event-minute-box', 'event-right']);
    expect(StyleSheet.flatten(screen.getByTestId('event-minute-box').props.style).backgroundColor).toBe(colors.surface10);
    expect(within(screen.getByTestId('event-minute-box')).getByText('90+2’')).toBeTruthy();
  });

  it('red card has accessibility label and red glyph', async () => {
    await render(<EventRow event={ev({ kind: 'red', primary: 'Pote' })} />);
    expect(screen.getByLabelText('Cartão vermelho')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('event-glyph').props.style).backgroundColor).toBe(colors.danger);
  });

  it('yellow card glyph uses the V7.1 yellow', async () => {
    await render(<EventRow event={ev({})} />);
    expect(screen.getByLabelText('Cartão amarelo')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('event-glyph').props.style).backgroundColor).toBe(colors.yellow71);
  });

  it('Sporting goal: name in primary-on-dark with the goal icon; opponent goal in white', async () => {
    await render(<EventRow event={ev({ kind: 'goal', primary: 'Trincão', secondary: 'assist. Morita' })} />);
    expect(screen.getByLabelText('Golo')).toBeTruthy();
    expect(screen.getByText('assist. Morita')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('event-name').props.style).color).toBe(colors.primaryOnDark);
    await render(<EventRow event={ev({ kind: 'goal', side: 'opponent', primary: 'Samu' })} />);
    expect(StyleSheet.flatten(screen.getAllByTestId('event-name').at(-1)!.props.style).color).toBe(colors.white);
  });

  it('sub has its icon; non-goal names are not in the goal colour', async () => {
    await render(<EventRow event={ev({ kind: 'sub', primary: 'Quaresma', secondary: 'sai Debast' })} />);
    expect(screen.getByLabelText('Substituição')).toBeTruthy();
    expect(screen.getByText('sai Debast')).toBeTruthy();
    expect(StyleSheet.flatten(screen.getByTestId('event-name').props.style).color).toBe(colors.white);
  });

  it('var: a VAR tag and no goal icon, even for a disallowed goal', async () => {
    await render(<EventRow event={ev({ kind: 'var', side: 'opponent', primary: 'Golo anulado', secondary: 'fora de jogo de Samu' })} />);
    expect(screen.getByLabelText('VAR')).toBeTruthy();
    expect(screen.getByText('VAR')).toBeTruthy();
    expect(screen.queryByLabelText('Golo')).toBeNull();
    expect(screen.getByText('Golo anulado')).toBeTruthy();
  });

  it('missed penalty: own label and a red outline ball, not the goal icon', async () => {
    await render(<EventRow event={ev({ kind: 'goal', primary: 'Gyökeres' })} />);
    const goalGlyph = screen.getByTestId('event-glyph').props.children;
    await render(<EventRow event={ev({ kind: 'missedPenalty', primary: 'Gyökeres', secondary: 'Penálti falhado' })} />);
    expect(screen.getByLabelText('Penálti falhado')).toBeTruthy();
    expect(screen.queryByLabelText('Golo')).toBeNull();
    const glyph = screen.getByTestId('event-glyph');
    expect(StyleSheet.flatten(glyph.props.style).color).toBe(colors.danger);
    expect(glyph.props.children).not.toEqual(goalGlyph);
  });

  it('long names stay on one line with ellipsis', async () => {
    await render(<EventRow event={ev({ primary: 'Maxi Araújo de Albuquerque Silva', secondary: 'sai Gonçalo Inácio Pereira' })} />);
    expect(screen.getByTestId('event-name').props.numberOfLines).toBe(1);
  });
});
