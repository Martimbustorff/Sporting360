// ModalSheet: folha escura (bg-raised, scrim V7.1) com grabber à esquerda (21b, 48b) ou ao centro (confirmações do jogo).
import { StyleSheet, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ModalSheet } from '@/components/ModalSheet';
import { colors } from '@/theme/tokens';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ui = (grabber?: 'left' | 'center', gap?: 'normal' | 'loose' | 'tight') => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <ModalSheet onClose={() => {}} grabber={grabber} gap={gap}>
      <Text>dentro</Text>
    </ModalSheet>
  </SafeAreaProvider>
);
const grabber = () => StyleSheet.flatten(screen.getByTestId('modal-sheet-grabber').props.style);

describe('ModalSheet', () => {
  it('por defeito o grabber fica à esquerda; fundo bg-raised', async () => {
    await render(ui());
    expect(grabber().alignSelf).toBe('flex-start');
    expect(StyleSheet.flatten(screen.getByTestId('modal-sheet').props.style).backgroundColor).toBe(colors.bgRaised);
    expect(screen.getByText('dentro')).toBeTruthy();
  });
  it('grabber="center" centra o grabber', async () => {
    await render(ui('center'));
    expect(grabber().alignSelf).toBe('center');
  });
});

describe('ModalSheet: ritmos dos frames', () => {
  const sheet = () => StyleSheet.flatten(screen.getByTestId('modal-sheet').props.style);
  it('normal (48b): elementos a 16 e o primeiro logo a 16 do grabber', async () => {
    await render(ui());
    expect(sheet().gap).toBe(16);
    expect(grabber().marginBottom).toBe(0);
  });
  it('loose (21b): elementos a 20', async () => {
    await render(ui('left', 'loose'));
    expect(sheet().gap).toBe(20);
  });
  it('tight (45Lb, 45Le): elementos a 14 e o título a 28 do topo (12 + 5 do grabber + 11)', async () => {
    await render(ui('center', 'tight'));
    expect(sheet().gap).toBe(14);
    expect(sheet().paddingTop).toBe(12);
    const g = grabber();
    expect(sheet().paddingTop + g.height + g.marginBottom + sheet().gap).toBe(28);
  });
});
