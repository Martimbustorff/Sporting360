// ModalSheet: folha escura (bg-raised, scrim V7.1) com grabber à esquerda (21b, 48b) ou ao centro (confirmações do jogo).
import { StyleSheet, Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ModalSheet } from '@/components/ModalSheet';
import { colors } from '@/theme/tokens';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ui = (grabber?: 'left' | 'center') => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <ModalSheet onClose={() => {}} grabber={grabber}>
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
