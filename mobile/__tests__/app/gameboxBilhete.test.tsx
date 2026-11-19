// Tarefa 5 (Plano 7): modo bilhete. Módulos nativos simulados (__mocks__): brilho, ecrã sempre ligado e orientação.
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import type { Match } from '@/data/schemas';

const V2_VECTOR = 'U2FsdGVkX19laDa3sLpkDovA2F5m78U+DLt5cd1AaFo='; // 266571276572 para o uid u1
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockParams: { current: Record<string, string> } = { current: { id: 'g1' } };
const mockFocused: { current: boolean } = { current: true };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams.current,
  useIsFocused: () => mockFocused.current,
}));
const mockBoxes: { current: unknown } = { current: { status: 'loading' } };
const mockUser: { current: unknown } = { current: { status: 'ready', data: { name: 'Maria Silva', memberNumber: '123 456' } } };
const mockMatches: { current: unknown } = { current: { status: 'ready', data: [] } };
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'u1', email: 'a@b.pt', providers: ['password'] } }),
}));
jest.mock('@/data/user', () => ({ useMyGameboxes: jest.fn(() => mockBoxes.current) }));
const mockLoans: { current: { id: string; gameboxId: string; matchId: string }[] } = { current: [] };
jest.mock('@/data/loans', () => ({
  useOwnerLoans: jest.fn((id: string) => ({ status: 'ready', data: mockLoans.current.filter((l) => l.gameboxId === id) })),
}));
jest.mock('@/services/loans', () => ({ cancelLoan: jest.fn(() => Promise.resolve()) }));
jest.mock('@/data/hooks', () => ({ useMyUser: jest.fn(() => mockUser.current) }));
// Dados por modalidade: `mockMatches.current` é a lista de jogos; cada hook devolve os da sua modalidade.
jest.mock('@/data/sports', () => ({
  useUpcomingMatches: jest.fn((sport: string) => {
    const m = mockMatches.current as { status: string; data?: { sport: string }[] };
    return m.status === 'ready' ? { status: 'ready', data: (m.data ?? []).filter((x) => x.sport === sport) } : m;
  }),
}));

import { StyleSheet } from 'react-native';
import { cancelLoan } from '@/services/loans';
import { colors } from '@/theme/tokens';
import * as Brightness from 'expo-brightness';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as ScreenOrientation from 'expo-screen-orientation';
import GameboxBilhete from '../../app/(app)/gamebox/bilhete';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ui = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <GameboxBilhete />
  </SafeAreaProvider>
);
const box = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  userid: 'u1',
  gameboxNumber: V2_VECTOR,
  gameboxName: 'Lugar anual',
  gameboxPort: '5',
  gameboxSector: 'A12',
  gameboxLine: '7',
  gameboxSeat: '14',
  pavilionPort: 'P1',
  pavilionSector: 'B2',
  pavilionLine: '3',
  pavilionSeat: '9',
  order: 1,
  default: false,
  ...extra,
});
const match = (sport: string, status = 'NS'): Match =>
  ({
    id: 'm1',
    sport,
    status,
    kickoff: new Date('2027-12-21T20:30:00Z'),
    competition: { key: 'k', id: '1', name: 'Liga', type: 'league', season: '2027', round: null, roundLabel: null },
    home: { id: '1', name: 'Sporting CP', logo: null },
    away: { id: '2', name: 'FC Porto', logo: null },
    sportingSide: 'home',
  }) as unknown as Match;

let appStateHandler: ((s: string) => void) | undefined;
const getBrightness = Brightness.getBrightnessAsync as jest.Mock;
const setBrightness = Brightness.setBrightnessAsync as jest.Mock;
const lock = ScreenOrientation.lockAsync as jest.Mock;
const flush = () => act(async () => {});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = { id: 'g1' };
  mockFocused.current = true;
  mockBoxes.current = { status: 'ready', data: [box('g1')] };
  mockMatches.current = { status: 'ready', data: [] };
  mockLoans.current = [];
  getBrightness.mockResolvedValue(0.4);
  appStateHandler = undefined;
  jest.spyOn(AppState, 'addEventListener').mockImplementation(((_: string, h: (s: string) => void) => {
    appStateHandler = h;
    return { remove: jest.fn() };
  }) as never);
});

describe('/gamebox/bilhete', () => {
  it('mostra o QR, o recinto, o nome e o número de sócio', async () => {
    await render(ui());
    await flush();
    expect(screen.getByText('Mostra este código na porta')).toBeTruthy();
    expect(screen.getByText('Maria Silva')).toBeTruthy();
    expect(screen.getByText('Sócio n.º 123 456')).toBeTruthy();
    // Sem jogo: lugar do Estádio.
    for (const v of ['5', 'A12', '7', '14']) expect(screen.getByText(v)).toBeTruthy();
  });

  it('com jogo seguinte mostra as equipas e a hora', async () => {
    mockMatches.current = { status: 'ready', data: [match('football')] };
    await render(ui());
    await flush();
    expect(screen.getByText('Sporting CP - FC Porto')).toBeTruthy();
    expect(screen.getByText(/20:30/)).toBeTruthy();
  });

  it('sem jogo seguinte a faixa mostra só o nome da GameBox', async () => {
    await render(ui());
    await flush();
    expect(screen.getByText('Lugar anual')).toBeTruthy();
    expect(screen.queryByText(/Alvalade|João Rocha/)).toBeNull();
  });

  it('o próximo jogo fora de casa não conta: sem Alvalade na faixa e sem jogo seguinte', async () => {
    const away = { ...match('football'), home: { id: '2', name: 'FC Porto', logo: null }, away: { id: '1', name: 'Sporting CP', logo: null }, sportingSide: 'away' };
    mockMatches.current = { status: 'ready', data: [away] };
    await render(ui());
    await flush();
    expect(screen.queryByText('FC Porto - Sporting CP')).toBeNull();
    expect(screen.queryByText(/Alvalade/)).toBeNull();
    expect(screen.getByText('Lugar anual')).toBeTruthy();
  });

  it('fora de casa no futebol salta para o próximo em casa de outra modalidade', async () => {
    const away = { ...match('football'), kickoff: new Date('2027-12-20T20:30:00Z'), sportingSide: 'away' };
    const futsal = { ...match('futsal'), id: 'm3', kickoff: new Date('2027-12-22T20:30:00Z') };
    mockMatches.current = { status: 'ready', data: [away, futsal] };
    await render(ui());
    await flush();
    expect(screen.getByText(/João Rocha/)).toBeTruthy();
    for (const v of ['P1', 'B2', '3', '9']) expect(screen.getByText(v)).toBeTruthy();
  });

  it('o jogo em casa mais cedo ganha entre modalidades', async () => {
    const futsal = { ...match('futsal'), id: 'm3', kickoff: new Date('2027-12-22T20:30:00Z') };
    mockMatches.current = { status: 'ready', data: [futsal, match('football')] };
    await render(ui());
    await flush();
    expect(screen.getByText(/Alvalade/)).toBeTruthy();
    expect(screen.queryByText('B2')).toBeNull();
  });

  it('Estádio no futebol e Pavilhão nas outras modalidades', async () => {
    mockMatches.current = { status: 'ready', data: [match('football')] };
    const a = await render(ui());
    await flush();
    expect(screen.getByText('A12')).toBeTruthy();
    expect(screen.queryByText('B2')).toBeNull();
    await a.unmount();
    mockMatches.current = { status: 'ready', data: [match('handball')] };
    await render(ui());
    await flush();
    for (const v of ['P1', 'B2', '3', '9']) expect(screen.getByText(v)).toBeTruthy();
    expect(screen.queryByText('A12')).toBeNull();
  });

  it('hoje terminou e há outro amanhã: mostra o de amanhã', async () => {
    const done = { ...match('football', 'FT'), id: 'm0', kickoff: new Date(Date.now() - 3 * 3_600_000), away: { id: '9', name: 'Gil Vicente', logo: null } };
    const next = { ...match('football'), id: 'm2', kickoff: new Date(Date.now() + 24 * 3_600_000) };
    mockMatches.current = { status: 'ready', data: [done, next] };
    await render(ui());
    await flush();
    expect(screen.getByText('Sporting CP - FC Porto')).toBeTruthy();
    expect(screen.queryByText('Sporting CP - Gil Vicente')).toBeNull();
  });

  it('jogo terminado não conta como jogo seguinte', async () => {
    mockMatches.current = { status: 'ready', data: [match('football', 'FT')] };
    await render(ui());
    await flush();
    expect(screen.queryByText('Sporting CP - FC Porto')).toBeNull();
  });

  it('número ilegível: a mensagem do cartão e sem QR', async () => {
    mockBoxes.current = { status: 'ready', data: [box('g1', { gameboxNumber: 'lixo' })] };
    await render(ui());
    await flush();
    expect(screen.getByText('Não foi possível ler o número desta GameBox. Corrige-o em Gestão de GameBox.')).toBeTruthy();
    expect(screen.queryByText('Mostra este código na porta')).toBeNull();
  });

  it('GameBox legada "Principal" abre pelo id principal', async () => {
    mockParams.current = { id: 'principal' };
    mockBoxes.current = { status: 'ready', data: [] };
    mockUser.current = { status: 'ready', data: { name: 'Maria', gameboxNumber: V2_VECTOR } };
    await render(ui());
    await flush();
    expect(screen.getByText('Mostra este código na porta')).toBeTruthy();
  });

  it('GameBox que já não existe', async () => {
    mockParams.current = { id: 'zzz' };
    await render(ui());
    await flush();
    expect(screen.getByText('Esta GameBox já não existe.')).toBeTruthy();
  });

  describe('várias GameBox: deslizar entre bilhetes', () => {
    const three = () => [
      box('g1', { gameboxName: 'Pai', order: 1, gameboxSeat: '14' }),
      box('g2', { gameboxName: 'Filho um', order: 2, gameboxSeat: '15' }),
      box('g3', { gameboxName: 'Filho dois', order: 3, gameboxSeat: '16' }),
    ];
    const control = () => screen.getByTestId('ticket-pager-control');
    const dotColors = () => screen.getAllByTestId('ticket-dot').map((d) => StyleSheet.flatten(d.props.style).backgroundColor);
    const scrollTo = (page: number) =>
      fireEvent(screen.getByTestId('ticket-pager'), 'momentumScrollEnd', {
        nativeEvent: { contentOffset: { x: page * 750, y: 0 }, contentSize: { width: 2250, height: 100 }, layoutMeasurement: { width: 750, height: 100 } },
      });

    it('uma página por GameBox, pela ordem guardada', async () => {
      mockBoxes.current = { status: 'ready', data: three() };
      await render(ui());
      await flush();
      expect(screen.getAllByText(/^(Pai|Filho um|Filho dois)$/, { includeHiddenElements: true }).map((n) => n.props.children)).toEqual(['Pai', 'Filho um', 'Filho dois']);
    });

    it('abre na página do id recebido', async () => {
      mockBoxes.current = { status: 'ready', data: three() };
      mockParams.current = { id: 'g2' };
      await render(ui());
      await flush();
      expect(screen.getByTestId('ticket-pager').props.initialScrollIndex).toBe(1);
      expect(control().props.accessibilityLabel).toBe('GameBox 2 de 3, Filho um');
      expect(dotColors()).toEqual([colors.surface20, colors.white, colors.surface20]);
    });

    it('pontos: um por GameBox e o ativo acompanha o deslize', async () => {
      mockBoxes.current = { status: 'ready', data: three() };
      await render(ui());
      await flush();
      expect(screen.getAllByTestId('ticket-dot')).toHaveLength(3);
      expect(dotColors()).toEqual([colors.white, colors.surface20, colors.surface20]);
      await scrollTo(2);
      expect(dotColors()).toEqual([colors.surface20, colors.surface20, colors.white]);
      expect(control().props.accessibilityLabel).toBe('GameBox 3 de 3, Filho dois');
    });

    it('uma só GameBox: sem pontos, sem paginação e sem controlo', async () => {
      mockBoxes.current = { status: 'ready', data: [box('g1')] };
      await render(ui());
      await flush();
      expect(screen.queryByTestId('ticket-dot')).toBeNull();
      expect(screen.queryByTestId('ticket-pager')).toBeNull();
      expect(screen.queryByTestId('ticket-pager-control')).toBeNull();
      expect(screen.getByText('Mostra este código na porta')).toBeTruthy();
    });

    it('acessibilidade: "GameBox N de M, nome" e ações seguinte e anterior', async () => {
      mockBoxes.current = { status: 'ready', data: three() };
      await render(ui());
      await flush();
      expect(control().props.accessibilityLabel).toBe('GameBox 1 de 3, Pai');
      expect(control().props.accessibilityActions.map((a: { name: string }) => a.name)).toEqual(['next', 'previous']);
      await fireEvent(control(), 'accessibilityAction', { nativeEvent: { actionName: 'previous' } });
      expect(control().props.accessibilityLabel).toBe('GameBox 1 de 3, Pai');
      await fireEvent(control(), 'accessibilityAction', { nativeEvent: { actionName: 'next' } });
      expect(control().props.accessibilityLabel).toBe('GameBox 2 de 3, Filho um');
      await fireEvent(control(), 'accessibilityAction', { nativeEvent: { actionName: 'next' } });
      await fireEvent(control(), 'accessibilityAction', { nativeEvent: { actionName: 'next' } });
      expect(control().props.accessibilityLabel).toBe('GameBox 3 de 3, Filho dois');
      await fireEvent(control(), 'accessibilityAction', { nativeEvent: { actionName: 'previous' } });
      expect(control().props.accessibilityLabel).toBe('GameBox 2 de 3, Filho um');
    });

    it('brilho e ecrã ligado mantêm-se ao mudar de página (uma só leitura, um só máximo)', async () => {
      mockBoxes.current = { status: 'ready', data: three() };
      await render(ui());
      await flush();
      await scrollTo(1);
      await scrollTo(2);
      await flush();
      expect(getBrightness).toHaveBeenCalledTimes(1);
      expect(setBrightness).toHaveBeenCalledTimes(1);
      expect(setBrightness).toHaveBeenLastCalledWith(1);
      expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
      expect(deactivateKeepAwake).not.toHaveBeenCalled();
    });
  });

  describe('brilho, ecrã ligado e orientação', () => {
    it('guarda o brilho, sobe ao máximo e repõe o valor ao sair do ecrã', async () => {
      const view = await render(ui());
      await flush();
      expect(getBrightness).toHaveBeenCalledTimes(1);
      expect(setBrightness).toHaveBeenLastCalledWith(1);
      await view.unmount();
      await flush();
      expect(setBrightness).toHaveBeenLastCalledWith(0.4);
      expect(setBrightness).toHaveBeenCalledTimes(2);
    });

    it('repõe o brilho quando o ecrã perde o foco e volta ao máximo ao regressar', async () => {
      const view = await render(ui());
      await flush();
      mockFocused.current = false;
      await view.rerender(ui());
      await flush();
      expect(setBrightness).toHaveBeenLastCalledWith(0.4);
      mockFocused.current = true;
      await view.rerender(ui());
      await flush();
      expect(setBrightness).toHaveBeenLastCalledWith(1);
    });

    it('repõe o brilho com a app em segundo plano e volta ao máximo ao ficar ativa', async () => {
      await render(ui());
      await flush();
      expect(setBrightness).toHaveBeenCalledTimes(1);
      await act(async () => appStateHandler?.('background'));
      expect(setBrightness).toHaveBeenLastCalledWith(0.4);
      getBrightness.mockResolvedValue(0.7); // o utilizador mexeu no brilho fora da app
      await act(async () => appStateHandler?.('active'));
      expect(setBrightness).toHaveBeenLastCalledWith(1);
      await act(async () => appStateHandler?.('background'));
      expect(setBrightness).toHaveBeenLastCalledWith(0.7);
    });

    it('sair antes de o brilho ser lido não deixa o ecrã no máximo', async () => {
      let resolve: (v: number) => void = () => {};
      getBrightness.mockReturnValue(new Promise<number>((r) => (resolve = r)));
      const view = await render(ui());
      await view.unmount();
      await act(async () => resolve(0.4));
      expect(setBrightness).not.toHaveBeenCalledWith(1);
    });

    it('segundo plano e ativa antes de a primeira leitura chegar: o valor original não se perde', async () => {
      let resolve: (v: number) => void = () => {};
      getBrightness.mockReturnValue(new Promise<number>((r) => (resolve = r)));
      const view = await render(ui());
      await act(async () => appStateHandler?.('background'));
      await act(async () => appStateHandler?.('active'));
      expect(getBrightness).toHaveBeenCalledTimes(1);
      getBrightness.mockResolvedValue(1); // se relesse, apanharia o máximo
      await act(async () => resolve(0.4));
      expect(setBrightness).toHaveBeenCalledTimes(1);
      expect(setBrightness).toHaveBeenLastCalledWith(1);
      await view.unmount();
      await flush();
      expect(setBrightness).toHaveBeenLastCalledWith(0.4);
    });

    it('um erro do módulo de brilho não parte o ecrã', async () => {
      getBrightness.mockRejectedValue(new Error('x'));
      await render(ui());
      await flush();
      expect(screen.getByText('Mostra este código na porta')).toBeTruthy();
    });

    it('mantém o ecrã ligado enquanto está em foco e desliga ao sair', async () => {
      const view = await render(ui());
      await flush();
      expect(activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
      const tag = (activateKeepAwakeAsync as jest.Mock).mock.calls[0][0];
      await view.unmount();
      expect(deactivateKeepAwake).toHaveBeenCalledWith(tag);
    });

    it('fixa a orientação em vertical e repõe o bloqueio da app ao sair', async () => {
      const view = await render(ui());
      await flush();
      expect(lock).toHaveBeenLastCalledWith(ScreenOrientation.OrientationLock.PORTRAIT_UP);
      lock.mockClear();
      await view.unmount();
      await flush();
      expect(lock).toHaveBeenLastCalledWith(ScreenOrientation.OrientationLock.PORTRAIT_UP);
    });
  });
});

describe('/gamebox/bilhete: GameBox emprestada', () => {
  const lent = (gameboxId: string, matchId = 'm1') => ({ id: `L-${gameboxId}`, gameboxId, matchId });

  it('emprestada para o jogo da faixa: sem QR, com o aviso e o cancelar; o lugar fica', async () => {
    mockMatches.current = { status: 'ready', data: [match('football')] };
    mockLoans.current = [lent('g1')];
    await render(ui());
    await flush();
    expect(screen.getByText('Emprestada para este jogo')).toBeTruthy();
    expect(screen.getByText('Cancela o empréstimo para voltares a usar o código.')).toBeTruthy();
    expect(screen.queryByTestId('qrcode')).toBeNull();
    expect(screen.queryByText('Mostra este código na porta')).toBeNull();
    expect(screen.getByText('A12')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar empréstimo' })).toBeTruthy();
  });

  it('emprestada para outro jogo: mostra o QR como sempre', async () => {
    mockMatches.current = { status: 'ready', data: [match('football')] };
    mockLoans.current = [lent('g1', 'outro')];
    await render(ui());
    await flush();
    expect(screen.getByTestId('qrcode')).toBeTruthy();
    expect(screen.queryByText('Emprestada para este jogo')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar empréstimo' })).toBeNull();
  });

  it('sem jogo na faixa não há estado emprestada', async () => {
    mockLoans.current = [lent('g1')];
    await render(ui());
    await flush();
    expect(screen.getByTestId('qrcode')).toBeTruthy();
  });

  it('cada página é a sua GameBox: só a emprestada perde o QR', async () => {
    mockBoxes.current = { status: 'ready', data: [box('g1'), box('g2', { order: 2 })] };
    mockMatches.current = { status: 'ready', data: [match('football')] };
    mockLoans.current = [lent('g2')];
    await render(ui());
    await flush();
    expect(screen.getAllByTestId('qrcode', { includeHiddenElements: true })).toHaveLength(1);
    expect(screen.getAllByText('Emprestada para este jogo', { includeHiddenElements: true })).toHaveLength(1);
  });

  it('cancelar pede confirmação e chama cancelLoan com o empréstimo', async () => {
    mockMatches.current = { status: 'ready', data: [match('football')] };
    mockLoans.current = [lent('g1')];
    await render(ui());
    await flush();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar empréstimo' }));
    expect(screen.getByText('Cancelar empréstimo?')).toBeTruthy();
    expect(cancelLoan).not.toHaveBeenCalled();
    const sheet = screen.getByTestId('modal-sheet');
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Cancelar empréstimo' }));
    await flush();
    expect(cancelLoan).toHaveBeenCalledWith('L-g1');
  });
});
