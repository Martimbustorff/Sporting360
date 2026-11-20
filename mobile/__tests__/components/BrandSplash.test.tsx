// 20/11 (Martim): splash de 1,5 s com os anéis, o S360 e a frase; sai em fade por cima da app.
import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { BrandSplash, SPLASH_TEXT } from '@/components/BrandSplash';
import { layout } from '@/theme/tokens';

const METRICS = { frame: { x: 0, y: 0, width: 402, height: 874 }, insets: { top: 62, left: 0, right: 0, bottom: 34 } };
const ui = (ready: boolean, onDone: () => void) => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <BrandSplash ready={ready} onDone={onDone} />
  </SafeAreaProvider>
);

beforeEach(() => jest.useFakeTimers());
afterEach(() => jest.useRealTimers());

it('mostra os anéis, o S360 e a frase do design do João', async () => {
  await render(ui(true, jest.fn()));
  expect(screen.getByTestId('splash-rings')).toBeTruthy();
  expect(screen.getByLabelText('S360')).toBeTruthy();
  expect(screen.getByText(SPLASH_TEXT.tagline)).toBeTruthy();
});

it('fica 1,5 s e só depois sai', async () => {
  const onDone = jest.fn();
  await render(ui(true, onDone));
  await act(async () => {
    jest.advanceTimersByTime(layout.splashMs - 1);
  });
  expect(onDone).not.toHaveBeenCalled();
  await act(async () => {
    jest.advanceTimersByTime(1);
  });
  expect(onDone).toHaveBeenCalledTimes(1);
});

it('com a sessão ainda a carregar espera por ela, mesmo depois de 1,5 s', async () => {
  const onDone = jest.fn();
  const view = await render(ui(false, onDone));
  await act(async () => {
    jest.advanceTimersByTime(layout.splashMs * 3);
  });
  expect(onDone).not.toHaveBeenCalled();
  await view.rerender(ui(true, onDone));
  expect(onDone).toHaveBeenCalledTimes(1);
});
