// Plano 8, Task 5: emprestar, partilhar e cancelar no detalhe da GameBox (app/(app)/gamebox/[id].tsx).
import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { Share, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const V2_VECTOR = 'U2FsdGVkX19laDa3sLpkDovA2F5m78U+DLt5cd1AaFo='; // 266571276572 para o uid u1
const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockParams: { current: Record<string, string> } = { current: { id: 'g1' } };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams.current,
}));
const mockBoxes: { current: unknown } = { current: { status: 'loading' } };
const mockLoans: { current: unknown } = { current: { status: 'ready', data: [] } };
const mockMatches: { current: unknown } = { current: { status: 'ready', data: [] } };
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'u1', email: 'a@b.pt', providers: ['password'] } }),
}));
jest.mock('@/data/user', () => ({ useMyGameboxes: jest.fn(() => mockBoxes.current) }));
const mockNotice: { current: { loanId: string } | null } = { current: null };
jest.mock('@/data/loans', () => ({
  useOwnerLoans: jest.fn(() => mockLoans.current),
  useOwnerLoanNotice: jest.fn(() => mockNotice.current),
  dismissOwnerLoanNotice: jest.fn(),
}));
const bySport = (sport: string) => {
  const m = mockMatches.current as { status: string; data?: { sport: string }[] };
  return m.status === 'ready' ? { status: 'ready', data: (m.data ?? []).filter((x) => x.sport === sport) } : m;
};
jest.mock('@/data/sports', () => ({ useUpcomingMatches: jest.fn((sport: string) => bySport(sport)) }));
jest.mock('@/services/gamebox', () => ({
  GameboxSaveError: class extends Error {},
  saveGamebox: jest.fn(),
  deleteGamebox: jest.fn(),
}));
jest.mock('@/services/loans', () => ({
  ...jest.requireActual('@/services/loans'),
  createLoan: jest.fn(),
  cancelLoan: jest.fn(),
}));

import { dismissOwnerLoanNotice } from '@/data/loans';
import { cancelLoan, createLoan, LoanError } from '@/services/loans';
import GameboxForm from '../../app/(app)/gamebox/[id]';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ui = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <GameboxForm />
  </SafeAreaProvider>
);
const box = (extra: Record<string, unknown> = {}) => ({
  id: 'g1',
  userid: 'u1',
  gameboxNumber: V2_VECTOR,
  gameboxName: 'Lugar anual',
  gameboxPort: '5',
  gameboxSector: 'A12',
  gameboxLine: '7',
  gameboxSeat: '14',
  order: 1,
  default: false,
  ...extra,
});
const DAY = 86_400_000;
const match = (id: string, sport: string, days: number, extra: Record<string, unknown> = {}) => ({
  id,
  sport,
  status: 'NS',
  kickoff: new Date(Date.now() + days * DAY),
  competition: { key: 'k', id: '1', name: 'Liga', type: 'league', season: '2027', round: null, roundLabel: null },
  home: { id: '228', name: 'Sporting CP', logo: null },
  away: { id: '2', name: id === 'm1' ? 'FC Porto' : `Rival ${id}`, logo: null },
  sportingSide: 'home',
  ...extra,
});
const loan = (extra: Record<string, unknown> = {}) => ({
  id: 'L1',
  gameboxId: 'g1',
  matchId: 'm1',
  match: { homeName: 'Sporting CP', awayName: 'FC Porto', kickoff: new Date(Date.now() + DAY), venue: 'stadium' },
  recipientName: null,
  openedAt: null,
  cancelledAt: null,
  expiresAt: new Date(Date.now() + 2 * DAY),
  ...extra,
});
const flush = () => act(async () => {});
const lendButton = () => screen.getByRole('button', { name: 'Emprestar para o próximo jogo' });
const share = jest.spyOn(Share, 'share');

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = { id: 'g1' };
  mockBoxes.current = { status: 'ready', data: [box()] };
  mockLoans.current = { status: 'ready', data: [] };
  mockNotice.current = null;
  mockMatches.current = { status: 'ready', data: [match('m1', 'football', 2)] };
  (jest.requireMock('@/data/sports') as { useUpcomingMatches: jest.Mock }).useUpcomingMatches.mockImplementation(bySport);
  share.mockResolvedValue({ action: 'sharedAction' } as never);
  (createLoan as jest.Mock).mockResolvedValue({ loanId: 'L1', url: 'https://h/e/L1' });
  (cancelLoan as jest.Mock).mockResolvedValue(undefined);
});

const PAVILION_ONLY = { gameboxPort: '', gameboxSector: '', gameboxLine: '', gameboxSeat: '', pavilionPort: '1', pavilionSector: 'B', pavilionLine: '2', pavilionSeat: '3' };
const NO_SEATS = { gameboxPort: '', gameboxSector: '', gameboxLine: '', gameboxSeat: '' };

describe('Emprestar: botão e folha de confirmação', () => {
  it('o detalhe mostra o botão e o aviso do link', async () => {
    await render(ui());
    expect(lendButton()).toBeTruthy();
    expect(screen.getByText('O link só abre na app S360 e expira no fim deste jogo.')).toBeTruthy();
  });

  it('uma GameBox nova não tem empréstimo', async () => {
    mockParams.current = { id: 'nova' };
    await render(ui());
    expect(screen.queryByRole('button', { name: 'Emprestar para o próximo jogo' })).toBeNull();
  });

  it('a folha mostra só o próximo jogo em casa do Estádio, sem lista nem escolha', async () => {
    mockMatches.current = {
      status: 'ready',
      data: [
        match('m2', 'football', 9),
        match('m1', 'football', 2),
        match('m3', 'football', 1, { sportingSide: 'away' }),
        match('m4', 'futsal', 1),
        match('m5', 'football', 0.5, { status: 'FT' }),
      ],
    };
    await render(ui());
    await fireEvent.press(lendButton());
    const sheet = screen.getByTestId('modal-sheet');
    expect(within(sheet).getByRole('header', { name: 'Emprestar para o próximo jogo' })).toBeTruthy();
    expect(within(sheet).getByText('Sporting CP - FC Porto')).toBeTruthy();
    expect(within(sheet).getByText('Estádio José Alvalade')).toBeTruthy();
    expect(within(sheet).queryByText(/Rival/)).toBeNull();
    expect(within(sheet).getAllByRole('button').map((b) => b.props.accessibilityLabel)).toEqual(['Emprestar']);
  });

  it('só com o lugar do Pavilhão preenchido mostra o próximo jogo em casa das outras modalidades, nunca o de futebol', async () => {
    mockMatches.current = { status: 'ready', data: [match('m4', 'futsal', 3), match('m1', 'football', 1)] };
    mockBoxes.current = { status: 'ready', data: [box(PAVILION_ONLY)] };
    await render(ui());
    await fireEvent.press(lendButton());
    const sheet = screen.getByTestId('modal-sheet');
    expect(within(sheet).getByText('Sporting CP - Rival m4')).toBeTruthy();
    expect(within(sheet).getByText('Pavilhão João Rocha')).toBeTruthy();
    expect(within(sheet).queryByText(/FC Porto/)).toBeNull();
  });

  it('o botão não depende do separador aberto: com Estádio e Pavilhão preenchidos, o jogo em casa mais próximo dos dois', async () => {
    mockMatches.current = { status: 'ready', data: [match('m1', 'football', 5), match('m4', 'futsal', 2)] };
    mockBoxes.current = { status: 'ready', data: [box({ pavilionPort: '1', pavilionSector: 'B', pavilionLine: '2', pavilionSeat: '3' })] };
    await render(ui());
    expect(screen.getByRole('tab', { name: /Estádio/ })).toBeTruthy();
    await fireEvent.press(lendButton());
    const sheet = screen.getByTestId('modal-sheet');
    expect(within(sheet).getByText('Sporting CP - Rival m4')).toBeTruthy();
    expect(within(sheet).getByText('Pavilhão João Rocha')).toBeTruthy();
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Emprestar' }));
    await flush();
    expect(createLoan).toHaveBeenCalledWith('g1', 'm4', '266571276572');
  });

  it('com o Pavilhão aberto a escolha é a mesma (o separador é só de edição)', async () => {
    mockMatches.current = { status: 'ready', data: [match('m1', 'football', 2), match('m4', 'futsal', 9)] };
    await render(ui());
    await fireEvent.press(screen.getByRole('tab', { name: /Pavilhão/ }));
    await fireEvent.press(lendButton());
    expect(within(screen.getByTestId('modal-sheet')).getByText('Sporting CP - FC Porto')).toBeTruthy();
  });

  it('sem lugar em nenhum recinto, o jogo mais próximo entre os dois', async () => {
    mockMatches.current = { status: 'ready', data: [match('m1', 'football', 6), match('m4', 'futsal', 3)] };
    mockBoxes.current = { status: 'ready', data: [box(NO_SEATS)] };
    await render(ui());
    await fireEvent.press(lendButton());
    expect(within(screen.getByTestId('modal-sheet')).getByText('Sporting CP - Rival m4')).toBeTruthy();
  });

  it('sem jogo em casa diz-o, só tem Fechar e não deixa criar', async () => {
    mockMatches.current = { status: 'ready', data: [match('m3', 'football', 1, { sportingSide: 'away' })] };
    await render(ui());
    await fireEvent.press(lendButton());
    const sheet = screen.getByTestId('modal-sheet');
    expect(within(sheet).getByText('Sem jogos em casa marcados para esta GameBox.')).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Emprestar' })).toBeNull();
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Fechar' }));
    expect(screen.queryByTestId('modal-sheet')).toBeNull();
    expect(createLoan).not.toHaveBeenCalled();
  });
});

describe('Emprestar: listas do recinto por ler', () => {
  const open = async () => {
    mockBoxes.current = { status: 'ready', data: [box(PAVILION_ONLY)] };
    await render(ui());
    await fireEvent.press(lendButton());
    return screen.getByTestId('modal-sheet');
  };
  // Pavilhão: uma modalidade por chegar, outra já com um jogo mais tarde.
  const mixed = (other: { status: string; error?: Error }) => {
    const later = match('m4', 'futsal', 5);
    mockMatches.current = { status: 'ready', data: [later] };
    const sports = jest.requireMock('@/data/sports') as { useUpcomingMatches: jest.Mock };
    sports.useUpcomingMatches.mockImplementation((sport: string) =>
      sport === 'handball' ? other : { status: 'ready', data: sport === 'futsal' ? [later] : [] },
    );
  };

  it('com uma lista ainda a carregar não oferece jogo nem Emprestar', async () => {
    mixed({ status: 'loading' });
    const sheet = await open();
    expect(within(sheet).queryByText(/Rival/)).toBeNull();
    expect(within(sheet).queryByRole('button', { name: 'Emprestar' })).toBeNull();
    expect(within(sheet).getByRole('button', { name: 'Fechar' })).toBeTruthy();
  });

  it('com uma lista em erro não oferece jogo, só a mensagem e Fechar', async () => {
    mixed({ status: 'error', error: new Error('x') });
    const sheet = await open();
    expect(within(sheet).queryByText(/Rival/)).toBeNull();
    expect(within(sheet).queryByRole('button', { name: 'Emprestar' })).toBeNull();
    expect(within(sheet).getByText('Não foi possível concluir. Tenta outra vez.')).toBeTruthy();
    expect(within(sheet).getByRole('button', { name: 'Fechar' })).toBeTruthy();
  });
});

describe('Emprestar: criar e partilhar', () => {
  it('dois toques seguidos em Emprestar criam e partilham uma só vez', async () => {
    let resolve!: (v: { loanId: string; url: string }) => void;
    (createLoan as jest.Mock).mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await render(ui());
    await fireEvent.press(lendButton());
    const go = screen.getByRole('button', { name: 'Emprestar' });
    await fireEvent.press(go);
    await fireEvent.press(go);
    await act(async () => resolve({ loanId: 'L1', url: 'https://h/e/L1' }));
    await flush();
    expect(createLoan).toHaveBeenCalledTimes(1);
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('cria com o número decifrado e abre a partilha com o texto do link', async () => {
    await render(ui());
    await fireEvent.press(lendButton());
    await fireEvent.press(screen.getByRole('button', { name: 'Emprestar' }));
    await flush();
    expect(createLoan).toHaveBeenCalledWith('g1', 'm1', '266571276572');
    expect(share).toHaveBeenCalledWith({
      message: 'Empresto-te a minha GameBox para o Sporting CP - FC Porto. Abre na app S360: https://h/e/L1',
    });
    expect(screen.queryByTestId('modal-sheet')).toBeNull();
  });

  it('já existir um empréstimo ativo mostra a mensagem e não partilha', async () => {
    (createLoan as jest.Mock).mockRejectedValueOnce(new LoanError('exists'));
    await render(ui());
    await fireEvent.press(lendButton());
    await fireEvent.press(screen.getByRole('button', { name: 'Emprestar' }));
    await flush();
    expect(screen.getByText('Esta GameBox já está emprestada.')).toBeTruthy();
    expect(share).not.toHaveBeenCalled();
    expect(screen.getByTestId('modal-sheet')).toBeTruthy();
  });

  it('sem rede e jogo que já não é o próximo têm mensagem própria', async () => {
    (createLoan as jest.Mock).mockRejectedValueOnce(new LoanError('offline'));
    await render(ui());
    await fireEvent.press(lendButton());
    await fireEvent.press(screen.getByRole('button', { name: 'Emprestar' }));
    await flush();
    expect(screen.getByText(/Sem ligação/)).toBeTruthy();
    (createLoan as jest.Mock).mockRejectedValueOnce(new LoanError('not-next'));
    await fireEvent.press(screen.getByRole('button', { name: 'Emprestar' }));
    await flush();
    expect(screen.getByText('Este jogo já não está disponível para empréstimo.')).toBeTruthy();
  });
});

describe('Aviso ao dono: quem recebeu apagou a conta', () => {
  const NOTICE = 'Quem recebeu esta GameBox apagou a conta. O empréstimo foi cancelado.';

  it('mostra o aviso por cima do botão de emprestar, com o X de 44 pt', async () => {
    mockNotice.current = { loanId: 'L9' };
    await render(ui());
    expect(screen.getByText(NOTICE)).toBeTruthy();
    expect(lendButton()).toBeTruthy();
    const close = screen.getByRole('button', { name: 'Fechar aviso' });
    const flat = StyleSheet.flatten(close.props.style);
    expect(flat.width).toBeGreaterThanOrEqual(44);
    expect(flat.height).toBeGreaterThanOrEqual(44);
  });

  it('o X fecha o aviso guardando o id do empréstimo', async () => {
    mockNotice.current = { loanId: 'L9' };
    await render(ui());
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(dismissOwnerLoanNotice).toHaveBeenCalledWith('L9');
  });

  it('sem aviso não aparece', async () => {
    await render(ui());
    expect(screen.queryByText(NOTICE)).toBeNull();
  });

  it('com um empréstimo ativo novo o aviso não aparece', async () => {
    mockNotice.current = { loanId: 'L9' };
    mockLoans.current = { status: 'ready', data: [loan()] };
    await render(ui());
    expect(screen.queryByText(NOTICE)).toBeNull();
  });
});

describe('Empréstimo ativo', () => {
  it('ainda não aberto: cartão, estado e cancelar; sem botão de emprestar', async () => {
    mockLoans.current = { status: 'ready', data: [loan()] };
    await render(ui());
    expect(screen.getByText('Emprestada para Sporting CP - FC Porto')).toBeTruthy();
    expect(screen.getByText('Ainda não aberto')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar empréstimo' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Emprestar para o próximo jogo' })).toBeNull();
  });

  it('mostra o aviso de que alterar o número ou o lugar cancela o empréstimo; sem empréstimo ativo não aparece', async () => {
    mockLoans.current = { status: 'ready', data: [loan()] };
    const { unmount } = await render(ui());
    expect(screen.getByText('Se alterares o número ou o lugar, o empréstimo é cancelado.')).toBeTruthy();
    await unmount();
    mockLoans.current = { status: 'ready', data: [] };
    await render(ui());
    expect(screen.queryByText('Se alterares o número ou o lugar, o empréstimo é cancelado.')).toBeNull();
  });

  it('aberto: "Aberto por {nome} às {HH:MM}"', async () => {
    mockLoans.current = { status: 'ready', data: [loan({ recipientName: 'leao_1906', openedAt: new Date('2027-12-21T18:42:00Z') })] };
    await render(ui());
    expect(screen.getByText('Aberto por leao_1906 às 18:42')).toBeTruthy();
  });

  it('partilhar outra vez: só enquanto não foi aberto, com o mesmo texto e link', async () => {
    mockLoans.current = { status: 'ready', data: [loan()] };
    const view = await render(ui());
    await fireEvent.press(screen.getByRole('button', { name: 'Partilhar link outra vez' }));
    expect(share).toHaveBeenCalledWith({
      message: 'Empresto-te a minha GameBox para o Sporting CP - FC Porto. Abre na app S360: https://s360-prognostico-download.web.app/e/L1',
    });
    await view.unmount();
    mockLoans.current = { status: 'ready', data: [loan({ recipientName: 'leao_1906', openedAt: new Date('2027-12-21T18:42:00Z') })] };
    await render(ui());
    expect(screen.queryByRole('button', { name: 'Partilhar link outra vez' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Cancelar empréstimo' })).toBeTruthy();
  });

  it('cancelar pede confirmação e só depois chama cancelLoan; Voltar não cancela', async () => {
    mockLoans.current = { status: 'ready', data: [loan()] };
    await render(ui());
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar empréstimo' }));
    const sheet = screen.getByTestId('modal-sheet');
    expect(within(sheet).getByRole('header', { name: 'Cancelar empréstimo?' })).toBeTruthy();
    expect(within(sheet).getByText('Quem recebeu deixa de ver a GameBox para este jogo.')).toBeTruthy();
    expect(cancelLoan).not.toHaveBeenCalled();
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Voltar' }));
    expect(screen.queryByTestId('modal-sheet')).toBeNull();
    expect(cancelLoan).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar empréstimo' }));
    await fireEvent.press(within(screen.getByTestId('modal-sheet')).getByRole('button', { name: 'Cancelar empréstimo' }));
    await flush();
    expect(cancelLoan).toHaveBeenCalledWith('L1');
    expect(screen.queryByTestId('modal-sheet')).toBeNull();
  });

  it('falha a cancelar mantém a folha e mostra a mensagem', async () => {
    mockLoans.current = { status: 'ready', data: [loan()] };
    (cancelLoan as jest.Mock).mockRejectedValueOnce(new LoanError('offline'));
    await render(ui());
    await fireEvent.press(screen.getByRole('button', { name: 'Cancelar empréstimo' }));
    await fireEvent.press(within(screen.getByTestId('modal-sheet')).getByRole('button', { name: 'Cancelar empréstimo' }));
    await flush();
    expect(screen.getByText(/Sem ligação/)).toBeTruthy();
    expect(screen.getByTestId('modal-sheet')).toBeTruthy();
  });
});
