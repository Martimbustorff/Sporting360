// Plano 8, Task 6: ecrã de quem recebe o empréstimo (/emprestimo/{id}). Frames 50, 50b, 50c (Figma V7.1).
// Serviços e leituras mockados; o ticketMode é o real (módulos nativos em __mocks__).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Brightness from 'expo-brightness';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const NUMBER = '266571276572';
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockParams: { current: Record<string, string> } = { current: { id: 'L1' } };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams.current,
  useIsFocused: () => true,
}));
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'u2', email: 'x@y.pt', providers: ['password'] } }),
}));
const mockCapture = { active: 0 };
jest.mock('expo-screen-capture', () => ({
  usePreventScreenCapture: () => {
    const { useEffect: mockUseEffect } = require('react') as typeof import('react');
    mockUseEffect(() => {
      mockCapture.active += 1;
      return () => {
        mockCapture.active -= 1;
      };
    }, []);
  },
}));
const mockLoan: { current: unknown } = { current: { status: 'loading' } };
const mockSecret: { current: unknown } = { current: { status: 'loading' } };
jest.mock('@/data/loans', () => ({
  useLoan: jest.fn((id: string | null) => (id ? mockLoan.current : { status: 'loading' })),
  useLoanSecret: jest.fn((id: string | null) => (id ? mockSecret.current : { status: 'loading' })),
}));
jest.mock('@/services/loans', () => ({ ...jest.requireActual('@/services/loans'), claimLoan: jest.fn() }));

import { useLoan, useLoanSecret } from '@/data/loans';
import { claimLoan, LoanError } from '@/services/loans';
import { GateCoverContext } from '@/providers/gateCover';
import Emprestimo from '../../app/(app)/emprestimo/[id]';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ui = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <Emprestimo />
  </SafeAreaProvider>
);
const DAY = 86_400_000;
const loan = (extra: Record<string, unknown> = {}) => ({
  ownerUid: 'u1',
  ownerName: 'leao_1906',
  gameboxId: 'g1',
  matchId: 'm1',
  sport: 'football',
  match: {
    homeName: 'Sporting CP',
    awayName: 'FC Porto',
    homeLogo: null,
    awayLogo: 'https://x/porto.png',
    competition: 'Liga Portugal',
    kickoff: new Date(Date.now() + DAY),
    venue: 'stadium',
  },
  seat: { gate: '10A', sector: 'B', row: '12', seat: '7' },
  createdAt: new Date(),
  expiresAt: new Date(Date.now() + 2 * DAY),
  recipientUid: 'u2',
  recipientName: null,
  openedAt: new Date(),
  cancelledAt: null,
  ...extra,
});
const flush = () => act(async () => {});
const claimed = () => (claimLoan as jest.Mock).mockResolvedValue('claimed');
const READY = () => {
  mockLoan.current = { status: 'ready', data: loan() };
  mockSecret.current = { status: 'ready', data: { number: NUMBER } };
};
const INACTIVE = 'Este empréstimo já não está ativo.';

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = { id: 'L1' };
  mockCapture.active = 0;
  mockLoan.current = { status: 'loading' };
  mockSecret.current = { status: 'loading' };
});

describe('Empréstimo (destinatário)', () => {
  it('abrir com sessão chama claimLoan uma vez e, com claimed, mostra o cartão', async () => {
    claimed();
    READY();
    const { rerender } = await render(ui());
    await flush();
    await rerender(ui());
    await flush();
    expect(claimLoan).toHaveBeenCalledTimes(1);
    expect(claimLoan).toHaveBeenCalledWith('L1');
    expect(screen.getByText('Liga Portugal')).toBeTruthy();
    expect(screen.getByText('Sporting CP')).toBeTruthy();
    expect(screen.getByText('FC Porto')).toBeTruthy();
    expect(screen.getByText(/ · /)).toBeTruthy();
    expect(screen.getByText('Estádio José Alvalade')).toBeTruthy();
    for (const t of ['Porta', '10A', 'Sector', 'B', 'Fila', '12', 'Lugar', '7']) expect(screen.getByText(t)).toBeTruthy();
    expect(screen.getByText('Emprestada por leao_1906')).toBeTruthy();
    expect(screen.getByText('Brilho no máximo enquanto este ecrã está aberto')).toBeTruthy();
    expect(screen.getByTestId('qrcode').props.value).toBe(NUMBER);
  });

  it('só se subscreve ao empréstimo e ao segredo depois do claim', async () => {
    let resolve!: (v: string) => void;
    (claimLoan as jest.Mock).mockReturnValue(new Promise((r) => (resolve = r)));
    READY();
    await render(ui());
    await flush();
    expect((useLoan as jest.Mock).mock.calls.every((c) => c[0] === null)).toBe(true);
    expect((useLoanSecret as jest.Mock).mock.calls.every((c) => c[0] === null)).toBe(true);
    expect(screen.queryByTestId('qrcode')).toBeNull();
    await act(async () => resolve('claimed'));
    expect((useLoan as jest.Mock).mock.calls.some((c) => c[0] === 'L1')).toBe(true);
    expect((useLoanSecret as jest.Mock).mock.calls.some((c) => c[0] === 'L1')).toBe(true);
    expect(screen.getByTestId('qrcode')).toBeTruthy();
  });

  it('mostra só os campos do lugar que estão preenchidos', async () => {
    claimed();
    mockLoan.current = { status: 'ready', data: loan({ seat: { gate: null, sector: '', row: '12', seat: null } }) };
    mockSecret.current = { status: 'ready', data: { number: NUMBER } };
    await render(ui());
    await flush();
    expect(screen.getByText('Fila')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    for (const t of ['Porta', 'Sector', 'Lugar']) expect(screen.queryByText(t)).toBeNull();
  });

  it('sem nenhum campo do lugar não desenha a linha', async () => {
    claimed();
    mockLoan.current = { status: 'ready', data: loan({ seat: { gate: null, sector: null, row: null, seat: null } }) };
    mockSecret.current = { status: 'ready', data: { number: NUMBER } };
    await render(ui());
    await flush();
    expect(screen.queryByText('Fila')).toBeNull();
    expect(screen.getByTestId('qrcode')).toBeTruthy();
  });

  it('pavilhão: Pavilhão João Rocha; sem nome do dono: só "Emprestada"', async () => {
    claimed();
    mockLoan.current = {
      status: 'ready',
      data: loan({ ownerName: null, match: { ...loan().match, venue: 'pavilion' } }),
    };
    mockSecret.current = { status: 'ready', data: { number: NUMBER } };
    await render(ui());
    await flush();
    expect(screen.getByText('Pavilhão João Rocha')).toBeTruthy();
    expect(screen.getByText('Emprestada')).toBeTruthy();
    expect(screen.queryByText(/Emprestada por/)).toBeNull();
  });

  it('o número da GameBox nunca está em texto, etiqueta de acessibilidade ou testID; o QR tem etiqueta genérica', async () => {
    claimed();
    READY();
    await render(ui());
    await flush();
    expect(screen.queryByText(new RegExp(NUMBER))).toBeNull();
    expect(screen.queryByText(/2665|7127|6572/)).toBeNull();
    const qr = screen.getByLabelText('Código QR da GameBox emprestada');
    expect(qr).toBeTruthy();
    const json = JSON.stringify(screen.toJSON(), (k, v) => (k === 'value' ? undefined : v));
    expect(json).not.toContain(NUMBER);
  });

  it('claimed-by-other: aviso sem QR e Fechar', async () => {
    (claimLoan as jest.Mock).mockRejectedValue(new LoanError('claimed-by-other'));
    READY();
    await render(ui());
    await flush();
    expect(screen.getByText('Este empréstimo já foi aberto noutra conta.')).toBeTruthy();
    expect(screen.queryByTestId('qrcode')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('inactive: aviso sem QR', async () => {
    (claimLoan as jest.Mock).mockRejectedValue(new LoanError('inactive'));
    READY();
    await render(ui());
    await flush();
    expect(screen.getByText(INACTIVE)).toBeTruthy();
    expect(screen.queryByTestId('qrcode')).toBeNull();
    expect(screen.getByRole('button', { name: 'Fechar' })).toBeTruthy();
  });

  it('Fechar sem histórico vai para a Home', async () => {
    mockRouter.canGoBack.mockReturnValueOnce(false);
    (claimLoan as jest.Mock).mockRejectedValue(new LoanError('inactive'));
    await render(ui());
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('owner: redireciona para a GameBox do dono', async () => {
    (claimLoan as jest.Mock).mockResolvedValue('owner');
    mockLoan.current = { status: 'ready', data: loan({ ownerUid: 'u2' }) };
    await render(ui());
    await flush();
    expect(mockRouter.replace).toHaveBeenCalledWith('/gamebox/g1');
    expect(screen.queryByTestId('qrcode')).toBeNull();
  });

  it('sem rede: mensagem e Tentar outra vez volta a pedir', async () => {
    (claimLoan as jest.Mock).mockRejectedValueOnce(new LoanError('offline')).mockResolvedValueOnce('claimed');
    // sem nada em cache; ao voltar a rede o claim passa e o servidor entrega o empréstimo
    await render(ui());
    await flush();
    expect(screen.getByText('Sem ligação. Tenta outra vez quando houver rede.')).toBeTruthy();
    expect(screen.queryByTestId('qrcode')).toBeNull();
    READY();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar outra vez' }));
    await flush();
    expect(claimLoan).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('qrcode')).toBeTruthy();
  });

  describe('sinal fraco à porta (claim falha sem rede)', () => {
    const offline = () => (claimLoan as jest.Mock).mockRejectedValue(new LoanError('offline'));

    it('com a cache a ter o empréstimo preso a esta conta e ativo: mostra o cartão com o segredo em cache', async () => {
      offline();
      READY();
      await render(ui());
      await flush();
      expect((useLoan as jest.Mock).mock.calls.some((c) => c[0] === 'L1')).toBe(true);
      expect(screen.getByTestId('qrcode').props.value).toBe(NUMBER);
      expect(screen.queryByText('Sem ligação. Tenta outra vez quando houver rede.')).toBeNull();
    });

    it('sem nada em cache: aviso de sem ligação com Tentar outra vez', async () => {
      offline();
      await render(ui());
      await flush();
      expect(screen.getByText('Sem ligação. Tenta outra vez quando houver rede.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Tentar outra vez' })).toBeTruthy();
      expect(screen.queryByTestId('qrcode')).toBeNull();
    });

    it('empréstimo em cache preso a outra conta: aviso, sem QR', async () => {
      offline();
      mockLoan.current = { status: 'ready', data: loan({ recipientUid: 'u9' }) };
      mockSecret.current = { status: 'ready', data: { number: NUMBER } };
      await render(ui());
      await flush();
      expect(screen.getByText('Sem ligação. Tenta outra vez quando houver rede.')).toBeTruthy();
      expect(screen.queryByTestId('qrcode')).toBeNull();
    });

    it('em cache mas já expirado pelo relógio: sem QR', async () => {
      offline();
      mockLoan.current = { status: 'ready', data: loan({ expiresAt: new Date(Date.now() - 1000) }) };
      mockSecret.current = { status: 'ready', data: { number: NUMBER } };
      await render(ui());
      await flush();
      expect(screen.getByText(INACTIVE)).toBeTruthy();
      expect(screen.queryByTestId('qrcode')).toBeNull();
    });

    it('cache em falta (a carregar) e depois o servidor com o empréstimo: mostra o cartão', async () => {
      offline();
      const { rerender } = await render(ui());
      await flush();
      expect(screen.queryByTestId('qrcode')).toBeNull();
      READY();
      await rerender(ui());
      await flush();
      expect(screen.getByTestId('qrcode')).toBeTruthy();
    });

    it('cache com o empréstimo e depois o servidor a dizer cancelado: o QR desaparece', async () => {
      offline();
      READY();
      const { rerender } = await render(ui());
      await flush();
      expect(screen.getByTestId('qrcode')).toBeTruthy();
      mockLoan.current = { status: 'ready', data: loan({ cancelledAt: new Date() }) };
      await rerender(ui());
      await flush();
      expect(screen.queryByTestId('qrcode')).toBeNull();
      expect(screen.getByText(INACTIVE)).toBeTruthy();
    });

    it('cache com o empréstimo e depois permissão negada (cancelado no servidor): "já não está ativo"', async () => {
      offline();
      READY();
      const { rerender } = await render(ui());
      await flush();
      mockLoan.current = { status: 'error', error: new Error('permission-denied') };
      mockSecret.current = { status: 'error', error: new Error('permission-denied') };
      await rerender(ui());
      await flush();
      expect(screen.queryByTestId('qrcode')).toBeNull();
      expect(screen.getByText(INACTIVE)).toBeTruthy();
    });

    it('sem ter visto o empréstimo preso, um erro de permissão não é "inativo": continua o aviso de sem ligação', async () => {
      offline();
      mockLoan.current = { status: 'error', error: new Error('permission-denied') };
      await render(ui());
      await flush();
      expect(screen.getByText('Sem ligação. Tenta outra vez quando houver rede.')).toBeTruthy();
    });

    it('o temporizador da validade esconde o QR sem rede', async () => {
      jest.useFakeTimers();
      try {
        offline();
        mockLoan.current = { status: 'ready', data: loan({ expiresAt: new Date(Date.now() + 60_000) }) };
        mockSecret.current = { status: 'ready', data: { number: NUMBER } };
        await render(ui());
        await flush();
        expect(screen.getByTestId('qrcode')).toBeTruthy();
        await act(async () => {
          jest.advanceTimersByTime(61_000);
        });
        expect(screen.queryByTestId('qrcode')).toBeNull();
        expect(screen.getByText(INACTIVE)).toBeTruthy();
      } finally {
        jest.useRealTimers();
      }
    });
  });

  it('erro desconhecido: mensagem genérica', async () => {
    (claimLoan as jest.Mock).mockRejectedValue(new LoanError('unknown'));
    await render(ui());
    await flush();
    expect(screen.getByText('Não foi possível concluir. Tenta outra vez.')).toBeTruthy();
  });

  it('a pedir o claim: sem cartão nem QR', async () => {
    (claimLoan as jest.Mock).mockReturnValue(new Promise(() => {}));
    READY();
    await render(ui());
    await flush();
    expect(screen.getByTestId('loan-loading')).toBeTruthy();
    expect(screen.queryByTestId('qrcode')).toBeNull();
    expect(screen.queryByText('Liga Portugal')).toBeNull();
  });

  it('o segredo a falhar por permissão troca já para "já não está ativo", sem QR e sem reabrir', async () => {
    claimed();
    READY();
    const { rerender } = await render(ui());
    await flush();
    expect(screen.getByTestId('qrcode')).toBeTruthy();
    mockSecret.current = { status: 'error', error: new Error('permission-denied') };
    await rerender(ui());
    await flush();
    expect(screen.getByText(INACTIVE)).toBeTruthy();
    expect(screen.queryByTestId('qrcode')).toBeNull();
    expect(screen.queryByText('Liga Portugal')).toBeNull();
    expect(claimLoan).toHaveBeenCalledTimes(1);
  });

  it('o empréstimo cancelado ou expirado no documento troca para "já não está ativo"', async () => {
    claimed();
    READY();
    const { rerender } = await render(ui());
    await flush();
    mockLoan.current = { status: 'ready', data: loan({ cancelledAt: new Date() }) };
    await rerender(ui());
    await flush();
    expect(screen.getByText(INACTIVE)).toBeTruthy();
    expect(screen.queryByTestId('qrcode')).toBeNull();
  });

  it('o empréstimo expirado (expiresAt no passado) não mostra o QR', async () => {
    claimed();
    mockLoan.current = { status: 'ready', data: loan({ expiresAt: new Date(Date.now() - 1000) }) };
    mockSecret.current = { status: 'ready', data: { number: NUMBER } };
    await render(ui());
    await flush();
    expect(screen.getByText(INACTIVE)).toBeTruthy();
    expect(screen.queryByTestId('qrcode')).toBeNull();
  });

  it('bloqueio de capturas, brilho e ecrã sempre ligado: ativos enquanto montado, libertados ao sair', async () => {
    claimed();
    READY();
    const { unmount } = await render(ui());
    await flush();
    expect(mockCapture.active).toBe(1);
    expect(Brightness.setBrightnessAsync).toHaveBeenCalledWith(1);
    expect(activateKeepAwakeAsync).toHaveBeenCalled();
    await unmount();
    await flush();
    expect(mockCapture.active).toBe(0);
    expect(Brightness.setBrightnessAsync).toHaveBeenLastCalledWith(0.4);
    expect(deactivateKeepAwake).toHaveBeenCalled();
  });

  it('segredo ainda a carregar (sem QR): brilho e ecrã ligado esperam; sobem quando o número chega', async () => {
    claimed();
    READY();
    mockSecret.current = { status: 'loading' };
    const view = await render(ui());
    await flush();
    expect(screen.queryByTestId('qrcode')).toBeNull();
    expect(Brightness.setBrightnessAsync).not.toHaveBeenCalled();
    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
    mockSecret.current = { status: 'ready', data: { number: NUMBER } };
    await view.rerender(ui());
    await flush();
    expect(screen.getByTestId('qrcode')).toBeTruthy();
    expect(Brightness.setBrightnessAsync).toHaveBeenCalledWith(1);
    expect(activateKeepAwakeAsync).toHaveBeenCalled();
  });

  it('com o BiometricGate por cima o cartão não sobe o brilho; ao abrir, sobe', async () => {
    claimed();
    READY();
    const gated = (covered: boolean) => (
      <GateCoverContext.Provider value={covered}>{ui()}</GateCoverContext.Provider>
    );
    const view = await render(gated(true));
    await flush();
    expect(Brightness.setBrightnessAsync).not.toHaveBeenCalled();
    expect(activateKeepAwakeAsync).not.toHaveBeenCalled();
    await view.rerender(gated(false));
    await flush();
    expect(Brightness.setBrightnessAsync).toHaveBeenCalledWith(1);
    expect(activateKeepAwakeAsync).toHaveBeenCalled();
  });

  it('o bloqueio de capturas também vale nos estados de aviso', async () => {
    (claimLoan as jest.Mock).mockRejectedValue(new LoanError('inactive'));
    await render(ui());
    await flush();
    expect(mockCapture.active).toBe(1);
  });

  describe('brilho e ecrã sempre ligado só com o cartão à vista', () => {
    const ticketOn = () => (Brightness.setBrightnessAsync as jest.Mock).mock.calls.length > 0 || (activateKeepAwakeAsync as jest.Mock).mock.calls.length > 0;

    it('a pedir o claim, "já não está ativo" e "aberto noutra conta": não ligam', async () => {
      (claimLoan as jest.Mock).mockReturnValue(new Promise(() => {}));
      const a = await render(ui());
      await flush();
      expect(ticketOn()).toBe(false);
      await a.unmount();
      (claimLoan as jest.Mock).mockRejectedValue(new LoanError('inactive'));
      const b = await render(ui());
      await flush();
      expect(ticketOn()).toBe(false);
      await b.unmount();
      (claimLoan as jest.Mock).mockRejectedValue(new LoanError('claimed-by-other'));
      await render(ui());
      await flush();
      expect(ticketOn()).toBe(false);
    });

    it('liga com o cartão e liberta quando o cartão dá lugar a "já não está ativo"', async () => {
      claimed();
      READY();
      const { rerender } = await render(ui());
      await flush();
      expect(Brightness.setBrightnessAsync).toHaveBeenCalledWith(1);
      expect(activateKeepAwakeAsync).toHaveBeenCalled();
      expect(deactivateKeepAwake).not.toHaveBeenCalled();
      mockSecret.current = { status: 'error', error: new Error('permission-denied') };
      await rerender(ui());
      await flush();
      expect(screen.getByText(INACTIVE)).toBeTruthy();
      expect(Brightness.setBrightnessAsync).toHaveBeenLastCalledWith(0.4);
      expect(deactivateKeepAwake).toHaveBeenCalled();
      expect(mockCapture.active).toBe(1); // o bloqueio de capturas continua no ecrã
    });
  });

  it('com o cartão à vista, passar da validade tira o QR e mostra "já não está ativo"', async () => {
    jest.useFakeTimers();
    try {
      claimed();
      mockLoan.current = { status: 'ready', data: loan({ expiresAt: new Date(Date.now() + 60_000) }) };
      mockSecret.current = { status: 'ready', data: { number: NUMBER } };
      await render(ui());
      await flush();
      expect(screen.getByTestId('qrcode')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(59_000);
      });
      expect(screen.getByTestId('qrcode')).toBeTruthy();
      await act(async () => {
        jest.advanceTimersByTime(2_000);
      });
      expect(screen.queryByTestId('qrcode')).toBeNull();
      expect(screen.getByText(INACTIVE)).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('owner com o documento em falta: "já não está ativo" em vez de ficar a carregar', async () => {
    (claimLoan as jest.Mock).mockResolvedValue('owner');
    mockLoan.current = { status: 'missing' };
    await render(ui());
    await flush();
    expect(screen.getByText(INACTIVE)).toBeTruthy();
    expect(screen.queryByTestId('loan-loading')).toBeNull();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('mudar o id da rota repõe o ecrã: novo claim e nada do estado anterior', async () => {
    (claimLoan as jest.Mock).mockRejectedValueOnce(new LoanError('claimed-by-other')).mockReturnValueOnce(new Promise(() => {}));
    const { rerender } = await render(ui());
    await flush();
    expect(screen.getByText('Este empréstimo já foi aberto noutra conta.')).toBeTruthy();
    mockParams.current = { id: 'L2' };
    await rerender(ui());
    await flush();
    expect(claimLoan).toHaveBeenCalledTimes(2);
    expect(claimLoan).toHaveBeenLastCalledWith('L2');
    expect(screen.queryByText('Este empréstimo já foi aberto noutra conta.')).toBeNull();
    expect(screen.getByTestId('loan-loading')).toBeTruthy();
  });
});
