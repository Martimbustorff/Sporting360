// Task 24: leitor da GameBox (/gamebox/ler). Câmara e router mockados; a leitura dispara-se pela prop capturada.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismissTo: jest.fn(), canGoBack: jest.fn(() => true) };
const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams.current,
}));

import { CameraView, useCameraPermissions } from 'expo-camera';
import GameboxLer, { LER_TEXT, UNKNOWN_CLEAR_MS } from '../../app/(app)/gamebox/ler';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ui = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <GameboxLer />
  </SafeAreaProvider>
);
const cameraMock = CameraView as unknown as jest.Mock;
const permMock = useCameraPermissions as unknown as jest.Mock;
type ScanProps = { onBarcodeScanned?: (r: { data: string; type: string }) => void; barcodeScannerSettings?: { barcodeTypes: string[] } };
const lastProps = (): ScanProps => cameraMock.mock.calls[cameraMock.mock.calls.length - 1][0] as ScanProps;

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = {};
  permMock.mockReturnValue([{ granted: true }, jest.fn(), jest.fn()]);
});

describe('/gamebox/ler', () => {
  it('lê QR, Code 128, EAN-13 e PDF417', async () => {
    await render(ui());
    expect(lastProps().barcodeScannerSettings?.barcodeTypes).toEqual(['qr', 'code128', 'ean13', 'pdf417']);
    expect(screen.getByRole('button', { name: LER_TEXT.manual })).toBeTruthy();
  });

  it('duas leituras seguidas: só a primeira conta e a câmara deixa de ler', async () => {
    await render(ui());
    const handler = lastProps().onBarcodeScanned!;
    await act(async () => {
      handler({ data: '266571276572', type: 'qr' });
      handler({ data: '111111111111', type: 'qr' });
    });
    expect(screen.getByLabelText(`${LER_TEXT.read} 266571276572`)).toBeTruthy();
    expect(screen.getByText('2665 7127 6572')).toBeTruthy();
    expect(screen.queryByLabelText(`${LER_TEXT.read} 111111111111`)).toBeNull();
    expect(lastProps().onBarcodeScanned).toBeUndefined();
  });

  it('título "Ler código" e, com número lido, só Confirmar e Corrigir (frame 46)', async () => {
    await render(ui());
    expect(screen.getByText(LER_TEXT.title)).toBeTruthy();
    expect(LER_TEXT.title).toBe('Ler código');
    await act(async () => lastProps().onBarcodeScanned!({ data: '266571276572', type: 'qr' }));
    expect(screen.queryByRole('button', { name: LER_TEXT.manual })).toBeNull();
    expect(screen.getByRole('button', { name: LER_TEXT.confirm })).toBeTruthy();
  });

  it('Corrigir volta a ligar a leitura', async () => {
    await render(ui());
    await act(async () => lastProps().onBarcodeScanned!({ data: '266571276572', type: 'qr' }));
    expect(lastProps().onBarcodeScanned).toBeUndefined();
    await fireEvent.press(screen.getByRole('button', { name: LER_TEXT.retry }));
    expect(lastProps().onBarcodeScanned).toEqual(expect.any(Function));
    expect(screen.queryByLabelText(`${LER_TEXT.read} 266571276572`)).toBeNull();
  });

  it('texto não numérico: "Código não reconhecido." e continua a ler', async () => {
    await render(ui());
    await act(async () => lastProps().onBarcodeScanned!({ data: 'https://exemplo.pt/abc', type: 'qr' }));
    expect(screen.getByText(LER_TEXT.unknown)).toBeTruthy();
    expect(lastProps().onBarcodeScanned).toEqual(expect.any(Function));
    await act(async () => lastProps().onBarcodeScanned!({ data: '12345', type: 'qr' }));
    expect(screen.getByText(LER_TEXT.unknown)).toBeTruthy();
    expect(screen.queryByText(LER_TEXT.read)).toBeNull();
  });

  it('Confirmar sem origem vai para /gamebox/nova com o número', async () => {
    await render(ui());
    await act(async () => lastProps().onBarcodeScanned!({ data: ' 2665 7127 6572 ', type: 'code128' }));
    await fireEvent.press(screen.getByRole('button', { name: LER_TEXT.confirm }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/gamebox/nova?numero=266571276572');
  });

  it('Confirmar volta à mesma instância do formulário de onde veio (dismissTo), sem novo formulário', async () => {
    mockParams.current = { from: 'abc123' };
    await render(ui());
    await act(async () => lastProps().onBarcodeScanned!({ data: '266571276572', type: 'qr' }));
    await fireEvent.press(screen.getByRole('button', { name: LER_TEXT.confirm }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith({ pathname: '/gamebox/[id]', params: { id: 'abc123', numero: '266571276572' } });
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('Confirmar com from=nova volta ao formulário novo', async () => {
    mockParams.current = { from: 'nova' };
    await render(ui());
    await act(async () => lastProps().onBarcodeScanned!({ data: '266571276572', type: 'qr' }));
    await fireEvent.press(screen.getByRole('button', { name: LER_TEXT.confirm }));
    expect(mockRouter.dismissTo).toHaveBeenCalledWith({ pathname: '/gamebox/[id]', params: { id: 'nova', numero: '266571276572' } });
  });

  it.each(['../definicoes', 'abc?x=1', 'a/b', ''])('from inválido (%p) cai em /gamebox/nova', async (bad) => {
    mockParams.current = { from: bad };
    await render(ui());
    await act(async () => lastProps().onBarcodeScanned!({ data: '266571276572', type: 'qr' }));
    await fireEvent.press(screen.getByRole('button', { name: LER_TEXT.confirm }));
    expect(mockRouter.dismissTo).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith('/gamebox/nova?numero=266571276572');
  });

  it.each([
    ['12345', false],
    ['123456', true],
    ['12345678901234567890', true],
    ['123456789012345678901', false],
  ])('limites: %p aceite = %p', async (data, ok) => {
    await render(ui());
    await act(async () => lastProps().onBarcodeScanned!({ data, type: 'code128' }));
    if (ok) {
      expect(screen.getByLabelText(`${LER_TEXT.read} ${data}`)).toBeTruthy();
    } else {
      expect(screen.getByText(LER_TEXT.unknown)).toBeTruthy();
      expect(lastProps().onBarcodeScanned).toEqual(expect.any(Function));
    }
  });

  it('"Código não reconhecido." desaparece passado um pouco, ou na leitura válida seguinte', async () => {
    jest.useFakeTimers();
    try {
      await render(ui());
      await act(async () => lastProps().onBarcodeScanned!({ data: 'abc', type: 'qr' }));
      expect(screen.getByText(LER_TEXT.unknown)).toBeTruthy();
      await act(async () => jest.advanceTimersByTime(UNKNOWN_CLEAR_MS));
      expect(screen.queryByText(LER_TEXT.unknown)).toBeNull();
      expect(screen.getByText(LER_TEXT.hint)).toBeTruthy();
      await act(async () => lastProps().onBarcodeScanned!({ data: 'abc', type: 'qr' }));
      expect(screen.getByText(LER_TEXT.unknown)).toBeTruthy();
      await act(async () => lastProps().onBarcodeScanned!({ data: '266571276572', type: 'qr' }));
      expect(screen.queryByText(LER_TEXT.unknown)).toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });

  it('Inserir manualmente com origem: volta ao formulário', async () => {
    mockParams.current = { from: 'abc123' };
    await render(ui());
    await fireEvent.press(screen.getByRole('button', { name: LER_TEXT.manual }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('Inserir manualmente sem origem: abre /gamebox/nova', async () => {
    await render(ui());
    await fireEvent.press(screen.getByRole('button', { name: LER_TEXT.manual }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/gamebox/nova');
  });

  it('permissão negada: explica, abre as definições e mantém a entrada manual', async () => {
    const request = jest.fn(() => Promise.resolve({ granted: false }));
    permMock.mockReturnValue([{ granted: false, canAskAgain: false }, request, jest.fn()]);
    const settings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined);
    try {
      await render(ui());
      expect(screen.getByText(LER_TEXT.denied)).toBeTruthy();
      expect(cameraMock).not.toHaveBeenCalled();
      expect(request).not.toHaveBeenCalled();
      await fireEvent.press(screen.getByRole('button', { name: LER_TEXT.settings }));
      expect(settings).toHaveBeenCalled();
      expect(screen.getByRole('button', { name: LER_TEXT.manual })).toBeTruthy();
    } finally {
      settings.mockRestore();
    }
  });

  it('primeiro pedido: pede uma vez e não mostra "sem acesso" enquanto o diálogo está aberto', async () => {
    let resolve: (v: { granted: boolean }) => void = () => {};
    const request = jest.fn(() => new Promise<{ granted: boolean }>((r) => (resolve = r)));
    permMock.mockReturnValue([{ granted: false, canAskAgain: true }, request, jest.fn()]);
    await render(ui());
    expect(request).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(LER_TEXT.denied)).toBeNull();
    expect(screen.getByTestId('gamebox-ler-loading')).toBeTruthy();
    await act(async () => resolve({ granted: false }));
    expect(screen.getByText(LER_TEXT.denied)).toBeTruthy();
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('ao voltar à app (definições) volta a ler a permissão', async () => {
    const getPermission = jest.fn(() => Promise.resolve({ granted: true }));
    permMock.mockReturnValue([{ granted: false, canAskAgain: false }, jest.fn(), getPermission]);
    const listeners: ((s: string) => void)[] = [];
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, l) => {
      listeners.push(l as (s: string) => void);
      return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
    try {
      await render(ui());
      expect(getPermission).not.toHaveBeenCalled();
      await act(async () => listeners.forEach((l) => l('active')));
      expect(getPermission).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
