import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Sheet } from '@/components/Sheet';

const wrap = (ui: React.ReactElement) => <GestureHandlerRootView>{ui}</GestureHandlerRootView>;
const base = { title: 'GameBox Digital', collapsedHeight: 100, expandedHeight: 500 };

describe('Sheet', () => {
  it('fechada: conteúdo escondido das tecnologias de apoio', async () => {
    await render(wrap(<Sheet {...base} open={false} onOpenChange={() => {}}><Text>corpo</Text></Sheet>));
    expect(screen.getByTestId('sheet-content', { hidden: true }).props.accessibilityElementsHidden).toBe(true);
  });
  it('aberta: conteúdo visível', async () => {
    await render(wrap(<Sheet {...base} open onOpenChange={() => {}}><Text>corpo</Text></Sheet>));
    expect(screen.getByTestId('sheet-content', { hidden: true }).props.accessibilityElementsHidden).toBe(false);
  });
  it('carregar no título abre', async () => {
    const onOpenChange = jest.fn();
    await render(wrap(<Sheet {...base} open={false} onOpenChange={onOpenChange}><Text>corpo</Text></Sheet>));
    fireEvent.press(screen.getByText('GameBox Digital'));
    expect(onOpenChange).toHaveBeenCalledWith(true);
  });
  it('carregar no título aberto fecha', async () => {
    const onOpenChange = jest.fn();
    await render(wrap(<Sheet {...base} open onOpenChange={onOpenChange}><Text>corpo</Text></Sheet>));
    fireEvent.press(screen.getByText('GameBox Digital'));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
