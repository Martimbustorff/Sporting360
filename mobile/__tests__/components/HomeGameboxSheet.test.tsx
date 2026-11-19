// Task 24: folha GameBox Digital da Home. Hook mockado; o número vem cifrado como na V2 e decifra-se só para o QR.
import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// CryptoJS.AES.encrypt('u1_266571276572', 'SCP3#$)=:JI)!F5860_u1') (vetor da Task 23)
const V2_VECTOR = 'U2FsdGVkX19laDa3sLpkDovA2F5m78U+DLt5cd1AaFo=';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }) }));
const mockBoxes: { current: unknown } = { current: { status: 'loading' } };
jest.mock('@/data/user', () => ({ useMyGameboxes: jest.fn(() => mockBoxes.current) }));
const mockUser: { current: unknown } = { current: { status: 'ready', data: {} } };
jest.mock('@/data/hooks', () => ({ useMyUser: jest.fn(() => mockUser.current) }));

import QRCode from 'react-native-qrcode-svg';
import { HomeGameboxSheet, SHEET_TEXT } from '@/components/HomeGameboxSheet';
import { useMyGameboxes } from '@/data/user';
import { colors, layout } from '@/theme/tokens';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ui = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <GestureHandlerRootView>
      <HomeGameboxSheet uid="u1" />
    </GestureHandlerRootView>
  </SafeAreaProvider>
);
const box = (id: string, order: number, extra: Record<string, unknown> = {}) => ({
  id,
  userid: 'u1',
  gameboxNumber: V2_VECTOR,
  gameboxName: '',
  gameboxPort: '5',
  gameboxSector: 'A27',
  gameboxLine: '18',
  gameboxSeat: '24',
  order,
  ...extra,
});
const open = async () => fireEvent.press(screen.getByRole('button', { name: SHEET_TEXT.title }));

beforeEach(() => {
  jest.clearAllMocks();
  mockBoxes.current = { status: 'loading' };
  mockUser.current = { status: 'ready', data: {} };
});

describe('HomeGameboxSheet', () => {
  it('lê as GameBox do uid e começa recolhida', async () => {
    mockBoxes.current = { status: 'ready', data: [] };
    await render(ui());
    expect(useMyGameboxes).toHaveBeenCalledWith('u1');
    expect(screen.getByText(SHEET_TEXT.title)).toBeTruthy();
    expect(screen.getByTestId('sheet-content', { hidden: true }).props.accessibilityElementsHidden).toBe(true);
  });

  it('sem GameBox: DIGITALIZAR abre o leitor e "insere manualmente" abre o formulário', async () => {
    mockBoxes.current = { status: 'ready', data: [] };
    await render(ui());
    await open();
    expect(screen.getByText(/Digitaliza o código de barras da tua GameBox ou/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: SHEET_TEXT.scan }));
    expect(mockPush).toHaveBeenCalledWith('/gamebox/ler');
    await fireEvent.press(screen.getByRole('link', { name: SHEET_TEXT.manual }));
    expect(mockPush).toHaveBeenCalledWith('/gamebox/nova');
  });

  it('com 2 GameBox: 2 páginas, QR com o número decifrado e pontos de paginação', async () => {
    mockBoxes.current = {
      status: 'ready',
      data: [
        box('a', 1, { gameboxName: 'João', pavilionPort: '1', pavilionSector: 'A1', pavilionLine: '5', pavilionSeat: '5' }),
        box('b', 2),
      ],
    };
    await render(ui());
    await open();
    expect(screen.getAllByTestId('gamebox-page')).toHaveLength(2);
    const qrs = screen.getAllByTestId('qrcode');
    expect(qrs).toHaveLength(2);
    expect(qrs[0]?.props.value).toBe('266571276572');
    expect((QRCode as unknown as jest.Mock).mock.calls.every(([p]) => p.value === '266571276572')).toBe(true);
    expect(screen.getByText('João')).toBeTruthy();
    expect(screen.getByText('GameBox 2')).toBeTruthy();
    expect(screen.getAllByText('266571276572')).toHaveLength(2);
    expect(screen.getAllByText('Estádio')).toHaveLength(2);
    expect(screen.getAllByText('Pavilhão')).toHaveLength(1);
    expect(screen.getAllByText('A27')).toHaveLength(2);
    expect(screen.getAllByTestId(/^pagination-dot/)).toHaveLength(2);
    expect(screen.queryByText(SHEET_TEXT.scan)).toBeNull();
  });

  it('número ilegível: sem QR e com explicação', async () => {
    mockBoxes.current = { status: 'ready', data: [box('a', 1, { gameboxNumber: 'U2FsdGVkX1-lixo' })] };
    await render(ui());
    await open();
    expect(screen.queryByTestId('qrcode')).toBeNull();
    expect(screen.getByText(SHEET_TEXT.unreadable)).toBeTruthy();
    expect(screen.queryAllByTestId(/^pagination-dot/)).toHaveLength(0);
  });

  it('erro de leitura: mensagem de erro', async () => {
    mockBoxes.current = { status: 'error', error: new Error('x') };
    await render(ui());
    await open();
    expect(screen.getByText(SHEET_TEXT.loadError)).toBeTruthy();
  });

  it('sem documentos e com número antigo no perfil (V2): mostra a GameBox "Principal" com QR decifrado', async () => {
    mockBoxes.current = { status: 'ready', data: [] };
    mockUser.current = { status: 'ready', data: { gameboxNumber: V2_VECTOR, gameboxPort: '5', gameboxSector: 'A27' } };
    await render(ui());
    await open();
    expect(screen.getAllByTestId('gamebox-page')).toHaveLength(1);
    expect(screen.getByText('Principal')).toBeTruthy();
    expect(screen.getByTestId('qrcode').props.value).toBe('266571276572');
    expect(screen.getByText('A27')).toBeTruthy();
    expect(screen.queryByText(SHEET_TEXT.scan)).toBeNull();
  });

  it('número antigo em claro com espaços também aparece como "Principal"', async () => {
    mockBoxes.current = { status: 'ready', data: [] };
    mockUser.current = { status: 'ready', data: { gameboxNumber: '2665 7127 6572' } };
    await render(ui());
    await open();
    expect(screen.getByTestId('qrcode').props.value).toBe('266571276572');
  });

  it('sem documentos: espera pelo perfil antes de mostrar o vazio', async () => {
    mockBoxes.current = { status: 'ready', data: [] };
    mockUser.current = { status: 'loading' };
    await render(ui());
    await open();
    expect(screen.getByTestId('gamebox-sheet-loading')).toBeTruthy();
    expect(screen.queryByText(SHEET_TEXT.scan)).toBeNull();
  });

  it('a carregar: esqueleto, sem botão de digitalizar', async () => {
    await render(ui());
    await open();
    expect(screen.getByTestId('gamebox-sheet-loading')).toBeTruthy();
    expect(screen.queryByText(SHEET_TEXT.scan)).toBeNull();
  });
});

describe('HomeGameboxSheet V7.1 (aberta)', () => {
  const sheetStyle = () => StyleSheet.flatten(screen.getByTestId('sheet').props.style);

  it('fechada é branca; aberta passa a noite (bg escuro)', async () => {
    mockBoxes.current = { status: 'ready', data: [box('a', 1)] };
    await render(ui());
    expect(sheetStyle().backgroundColor).toBe(colors.white);
    await open();
    expect(sheetStyle().backgroundColor).toBe(colors.bg);
  });

  it('tocar no QR abre o modo bilhete da GameBox', async () => {
    mockBoxes.current = { status: 'ready', data: [box('a b', 1)] };
    await render(ui());
    await open();
    await fireEvent.press(screen.getByRole('button', { name: /Código QR da GameBox/ }));
    expect(mockPush).toHaveBeenCalledWith('/gamebox/bilhete?id=a%20b');
  });

  it('a película por trás fecha a folha e só existe aberta', async () => {
    mockBoxes.current = { status: 'ready', data: [box('a', 1)] };
    await render(ui());
    expect(screen.queryByTestId('gamebox-scrim')).toBeNull();
    await open();
    await fireEvent.press(screen.getByTestId('gamebox-scrim'));
    expect(screen.queryByTestId('gamebox-scrim')).toBeNull();
    expect(sheetStyle().backgroundColor).toBe(colors.white);
  });

  it('o estado vazio abre mais baixo do que o das GameBox', async () => {
    mockBoxes.current = { status: 'ready', data: [] };
    const empty = await render(ui());
    await open();
    const emptyH = sheetStyle().height as number;
    empty.unmount();
    mockBoxes.current = { status: 'ready', data: [box('a', 1)] };
    await render(ui());
    await open();
    const fullH = sheetStyle().height as number;
    expect(emptyH).toBeLessThan(fullH);
    expect(layout.gameboxEmptyOpenHeight).toBeLessThan(layout.gameboxOpenHeight);
  });
});
