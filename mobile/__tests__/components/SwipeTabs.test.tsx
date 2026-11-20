import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SwipeTabs } from '@/components/SwipeTabs';

it('mostra o conteúdo do separador ativo dentro da área de arrasto', async () => {
  await render(
    <SwipeTabs keys={['a', 'b'] as const} value="a" onChange={jest.fn()}>
      <Text>conteúdo A</Text>
    </SwipeTabs>,
  );
  expect(screen.getByTestId('swipe-tabs')).toBeTruthy();
  expect(screen.getByText('conteúdo A')).toBeTruthy();
});

it('slide={false} não volta a montar o conteúdo ao mudar de separador', async () => {
  const view = await render(
    <SwipeTabs keys={['a', 'b'] as const} value="a" onChange={jest.fn()} slide={false}>
      <Text testID="same">lista</Text>
    </SwipeTabs>,
  );
  const before = screen.getByTestId('same');
  await view.rerender(
    <SwipeTabs keys={['a', 'b'] as const} value="b" onChange={jest.fn()} slide={false}>
      <Text testID="same">lista</Text>
    </SwipeTabs>,
  );
  expect(screen.getByTestId('same')).toBe(before);
});
