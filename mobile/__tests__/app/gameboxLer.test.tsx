// Task 24: leitor da GameBox (/gamebox/ler). Câmara e router mockados; a leitura dispara-se pela prop capturada.
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams.current,
}));

import { CameraView, useCameraPermissions } from 'expo-camera';
import GameboxLer, { LER_TEXT } from '../../app/(app)/gamebox/ler';

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
    expect(screen.getByText(`${LER_TEXT.read} 266571276572`)).toBeTruthy();
    expect(screen.queryByText(`${LER_TEXT.read} 111111111111`)).toBeNull();
    expect(lastProps().onBarcodeScanned).toBeUndefined();
  });

  it('Corrigir volta a ligar a leitura', async () => {
    await render(ui());
    await act(async () => lastProps().onBarcodeScanned!({ data: '266571276572', type: 'qr' }));
    expect(lastProps().onBarcodeScanned).toBeUndefined();
    await fireEvent.press(screen.getByRole('button', { name: LER_TEXT.retry }));
    expect(lastProps().onBarcodeScanned).toEqual(expect.any(Function));
    expect(screen.queryByText(`${LER_TEXT.read} 266571276572`)).toBeNull();
  });

  it('texto não numérico: "Código não reconhecido." e continua a ler', async () => {
    await render(ui());
    await act(async () => lastProps().onBarcodeScanned!({ data: 'https://exemplo.pt/abc', type: 'qr' }));
    expect(screen.getByText(LER_TEXT.unknown)).toBeTruthy();
    expect(lastProps().onBarcodeScanned).toEqual(expect.any(Function));
    await act(async () => lastProps().onBarcodeScanned!({ data: '12345', type: 'qr' }));
    expect(screen.getByText(LER_TEXT.unknown)).toBeTruthy();
    expect(screen.queryByText(new RegExp(LER_TEXT.read))).toBeNull();
  });

  it('Confirmar sem origem vai para /gamebox/nova com o número', async () => {
    await render(ui());
    await act(async () => lastProps().onBarcodeScanned!({ data: ' 2665 7127 6572 ', type: 'code128' }));
    await fireEvent.press(screen.getByRole('button', { name: LER_TEXT.confirm }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/gamebox/nova?numero=266571276572');
  });

  it('Confirmar devolve ao formulário de onde veio', async () => {
    mockParams.current = { from: 'abc123' };
    await render(ui());
    await act(async () => lastProps().onBarcodeScanned!({ data: '266571276572', type: 'qr' }));
    await fireEvent.press(screen.getByRole('button', { name: LER_TEXT.confirm }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/gamebox/abc123?numero=266571276572');
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
    permMock.mockReturnValue([{ granted: false, canAskAgain: false }, request]);
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
      permMock.mockReturnValue([{ granted: true }, jest.fn()]);
    }
  });

  it('permissão por pedir: pede uma vez', async () => {
    const request = jest.fn(() => Promise.resolve({ granted: false }));
    permMock.mockReturnValue([{ granted: false, canAskAgain: true }, request]);
    try {
      await render(ui());
      expect(request).toHaveBeenCalledTimes(1);
    } finally {
      permMock.mockReturnValue([{ granted: true }, jest.fn()]);
    }
  });
});
