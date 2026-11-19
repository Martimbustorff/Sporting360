// Task 23: Gestão de GameBox (lista) e formulário (nova / editar). Hooks, serviço e router mockados.
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const V2_VECTOR = 'U2FsdGVkX19laDa3sLpkDovA2F5m78U+DLt5cd1AaFo=';

const mockRouter = { push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: jest.fn(() => true) };
const mockParams: { current: Record<string, string> } = { current: {} };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams.current,
}));
const mockBoxes: { current: unknown } = { current: { status: 'loading' } };
const mockUser: { current: unknown } = { current: { status: 'loading' } };
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'u1', email: 'a@b.pt', providers: ['password'] } }),
}));
jest.mock('@/data/user', () => ({ useMyGameboxes: jest.fn(() => mockBoxes.current) }));
jest.mock('@/data/hooks', () => ({ useMyUser: jest.fn(() => mockUser.current) }));
const mockRecipientLoans: { current: unknown } = { current: { status: 'ready', data: [] } };
jest.mock('@/data/loans', () => ({
  useOwnerLoans: jest.fn(() => ({ status: 'ready', data: [] })),
  useOwnerLoanNotice: jest.fn(() => null),
  dismissOwnerLoanNotice: jest.fn(),
  useRecipientLoans: jest.fn(() => mockRecipientLoans.current),
}));
jest.mock('@/data/sports', () => ({ useUpcomingMatches: jest.fn(() => ({ status: 'ready', data: [] })) }));
jest.mock('@/services/gamebox', () => {
  class GameboxSaveError extends Error {
    saveCode: string;
    id?: string;
    constructor(code: string, id?: string) {
      super(code);
      this.saveCode = code;
      this.id = id;
    }
  }
  return {
    GameboxSaveError,
    saveGamebox: jest.fn(() => Promise.resolve('new1')),
    reorderGameboxes: jest.fn(() => Promise.resolve()),
    deleteGamebox: jest.fn(() => Promise.resolve()),
  };
});

import { deleteGamebox, GameboxSaveError, reorderGameboxes, saveGamebox } from '@/services/gamebox';
import GameboxList from '../../app/(app)/gamebox/index';
import GameboxForm from '../../app/(app)/gamebox/[id]';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (el: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICS}>{el}</SafeAreaProvider>;
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
  default: false,
  ...extra,
});
const ready = (data: unknown) => ({ status: 'ready', data });
const save = () => screen.getByRole('button', { name: 'Guardar' });

beforeEach(() => {
  jest.clearAllMocks();
  mockParams.current = {};
  mockBoxes.current = ready([]);
  mockUser.current = ready({ name: 'Maria' });
  mockRecipientLoans.current = ready([]);
});

describe('Gestão de GameBox', () => {
  it('lista "GameBox N" ou o nome e abre cada uma', async () => {
    mockBoxes.current = ready([box('g1', 1, { gameboxName: 'João' }), box('g2', 2)]);
    await render(wrap(<GameboxList />));
    expect(screen.getByText('Gestão de GameBox')).toBeTruthy();
    expect(screen.getByText('João')).toBeTruthy();
    expect(screen.getByText('GameBox 2')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'GameBox 2' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/gamebox/g2');
  });

  describe('arrastar para reordenar', () => {
    const labels = () => screen.getAllByRole('button').map((b) => b.props.accessibilityLabel).filter((l: string) => /^(João|GameBox|Ana)/.test(l));
    const act1 = (name: string, action: string) =>
      fireEvent(screen.getByRole('button', { name }), 'accessibilityAction', { nativeEvent: { actionName: action } });
    beforeEach(() => {
      mockBoxes.current = ready([box('g1', 1, { gameboxName: 'João' }), box('g2', 2, { gameboxName: 'Ana' }), box('g3', 3, { gameboxName: 'GameBox X' })]);
    });

    it('cada linha tem pega de arrastar e ações de mover', async () => {
      await render(wrap(<GameboxList />));
      expect(screen.getAllByTestId('gamebox-drag-handle', { includeHiddenElements: true })).toHaveLength(3);
      expect(screen.getByRole('button', { name: 'João' }).props.accessibilityActions).toEqual([
        { name: 'moveUp', label: 'Mover para cima' },
        { name: 'moveDown', label: 'Mover para baixo' },
      ]);
    });

    it('mover para baixo grava a nova ordem e mostra-a já', async () => {
      await render(wrap(<GameboxList />));
      await act1('João', 'moveDown');
      expect(reorderGameboxes).toHaveBeenCalledWith(['g2', 'g1', 'g3'], { g1: 1, g2: 2, g3: 3 });
      expect(labels()).toEqual(['Ana', 'João', 'GameBox X']);
    });

    it('a primeira não sobe e a última não desce', async () => {
      await render(wrap(<GameboxList />));
      await act1('João', 'moveUp');
      await act1('GameBox X', 'moveDown');
      expect(reorderGameboxes).not.toHaveBeenCalled();
    });

    it('falha ao gravar: volta à ordem anterior com mensagem', async () => {
      (reorderGameboxes as jest.Mock).mockRejectedValueOnce(new GameboxSaveError('OFFLINE'));
      await render(wrap(<GameboxList />));
      await act1('Ana', 'moveUp');
      expect(await screen.findByText('Não foi possível guardar a nova ordem. Tenta outra vez.')).toBeTruthy();
      expect(labels()).toEqual(['João', 'Ana', 'GameBox X']);
    });
  });

  describe('emprestadas a mim (frame 44L)', () => {
    const lent = (id: string, ownerName: string | null, away = 'FC Porto') => ({
      id,
      ownerName,
      match: { homeName: 'Sporting CP', awayName: away, kickoff: new Date(Date.now() + 86_400_000) },
    });

    it('mostra "Sporting CP - FC Porto" e "Emprestada por {nome}", sem pega, e abre o empréstimo', async () => {
      mockBoxes.current = ready([box('g1', 1, { gameboxName: 'João' })]);
      mockRecipientLoans.current = ready([lent('L1', 'leao_1906')]);
      await render(wrap(<GameboxList />));
      expect(screen.getByText('Sporting CP - FC Porto')).toBeTruthy();
      expect(screen.getByText('Emprestada por leao_1906')).toBeTruthy();
      expect(screen.getAllByTestId('gamebox-drag-handle', { includeHiddenElements: true })).toHaveLength(1);
      await fireEvent.press(screen.getByRole('button', { name: 'Sporting CP - FC Porto, Emprestada por leao_1906' }));
      expect(mockRouter.push).toHaveBeenCalledWith('/emprestimo/L1');
    });

    it('sem nome do dono mostra só "Emprestada"', async () => {
      mockRecipientLoans.current = ready([lent('L1', null)]);
      await render(wrap(<GameboxList />));
      expect(screen.getByText('Emprestada')).toBeTruthy();
    });

    it('com empréstimos mas sem GameBox próprias não mostra o vazio', async () => {
      mockRecipientLoans.current = ready([lent('L1', 'ana')]);
      await render(wrap(<GameboxList />));
      expect(screen.queryByText('Ainda não tens nenhuma GameBox. Toca em + para adicionar.')).toBeNull();
    });
  });

  it('o "+" abre a nova', async () => {
    await render(wrap(<GameboxList />));
    await fireEvent.press(screen.getByRole('button', { name: 'Adicionar GameBox' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/gamebox/nova');
  });

  it('a carregar mostra o esqueleto; erro de leitura mostra o erro', async () => {
    mockBoxes.current = { status: 'loading' };
    await render(wrap(<GameboxList />));
    expect(screen.getByTestId('gamebox-loading')).toBeTruthy();
    mockBoxes.current = { status: 'error', error: new Error('x') };
    await render(wrap(<GameboxList />));
    expect(screen.getByText('Não foi possível carregar as tuas GameBox.')).toBeTruthy();
  });

  it('sem GameBox nem número no perfil mostra o vazio', async () => {
    await render(wrap(<GameboxList />));
    expect(screen.getByText('Ainda não tens nenhuma GameBox. Toca em + para adicionar.')).toBeTruthy();
    expect(screen.queryByText('Principal')).toBeNull();
  });

  it('dados da cache mostram o aviso', async () => {
    mockBoxes.current = { status: 'ready', data: [box('g1', 1)], fromCache: true };
    await render(wrap(<GameboxList />));
    expect(screen.getByTestId('offline-banner')).toBeTruthy();
  });

  describe('GameBox antiga só no perfil (users/{uid}.gameboxNumber)', () => {
    it('mostra "Principal" com o número decifrado e guarda-a na coleção no formato da V2', async () => {
      mockUser.current = ready({ name: 'Maria', gameboxNumber: V2_VECTOR });
      await render(wrap(<GameboxList />));
      expect(screen.getByText('Principal')).toBeTruthy();
      expect(screen.getByText('266571276572')).toBeTruthy();
      await fireEvent.press(screen.getByRole('button', { name: 'Guardar na minha GameBox' }));
      expect(saveGamebox).toHaveBeenCalledWith(
        'u1',
        { number: '266571276572', name: 'Principal', stadium: { port: '', sector: '', line: '', seat: '' }, pavilion: null },
        undefined,
        1,
        undefined,
      );
    });

    it('número em claro também serve', async () => {
      mockUser.current = ready({ gameboxNumber: '266571276572', gameboxName: 'Casa' });
      await render(wrap(<GameboxList />));
      expect(screen.getByText('Casa')).toBeTruthy();
      expect(screen.getByText('266571276572')).toBeTruthy();
    });

    it('com documentos na coleção não aparece', async () => {
      mockBoxes.current = ready([box('g1', 1)]);
      mockUser.current = ready({ gameboxNumber: V2_VECTOR });
      await render(wrap(<GameboxList />));
      expect(screen.queryByText('Principal')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Guardar na minha GameBox' })).toBeNull();
    });

    it('sem rede: mensagem clara e o botão continua disponível', async () => {
      mockUser.current = ready({ gameboxNumber: V2_VECTOR });
      (saveGamebox as jest.Mock).mockRejectedValueOnce(new GameboxSaveError('OFFLINE', 'auto9'));
      await render(wrap(<GameboxList />));
      await fireEvent.press(screen.getByRole('button', { name: 'Guardar na minha GameBox' }));
      expect(screen.getByText(/Sem ligação/)).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Guardar na minha GameBox' }).props.accessibilityState.disabled).toBe(false);
      // Repetir depois do tempo limite usa o mesmo documento (setDoc no serviço, não duplica).
      await fireEvent.press(screen.getByRole('button', { name: 'Guardar na minha GameBox' }));
      expect((saveGamebox as jest.Mock).mock.calls[1].slice(2)).toEqual([undefined, 1, 'auto9']);
    });

    it('depois de DENIED a tentativa seguinte não reutiliza id', async () => {
      mockUser.current = ready({ gameboxNumber: V2_VECTOR });
      (saveGamebox as jest.Mock)
        .mockRejectedValueOnce(new GameboxSaveError('OFFLINE', 'auto9'))
        .mockRejectedValueOnce(new GameboxSaveError('DENIED'));
      await render(wrap(<GameboxList />));
      const btn = () => screen.getByRole('button', { name: 'Guardar na minha GameBox' });
      await fireEvent.press(btn());
      await fireEvent.press(btn());
      await fireEvent.press(btn());
      expect((saveGamebox as jest.Mock).mock.calls[2].slice(2)).toEqual([undefined, 1, undefined]);
    });
  });
});

describe('Formulário da GameBox', () => {
  it('nova: Guardar desativado até haver número válido', async () => {
    mockParams.current = { id: 'nova' };
    await render(wrap(<GameboxForm />));
    expect(save().props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Número da GameBox'), '2665abc');
    expect(screen.getByText('O número da GameBox tem só algarismos.')).toBeTruthy();
    expect(save().props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Número da GameBox'), '123');
    expect(screen.getByText('O número da GameBox tem entre 6 e 20 algarismos.')).toBeTruthy();
    expect(save().props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Número da GameBox'), '2665 7127 6572');
    expect(screen.queryByText('O número da GameBox tem só algarismos.')).toBeNull();
    expect(save().props.accessibilityState.disabled).toBe(false);
  });

  it('nova: guarda no ✓ com a ordem seguinte e volta à lista', async () => {
    mockParams.current = { id: 'nova' };
    mockBoxes.current = ready([box('g1', 1)]);
    await render(wrap(<GameboxForm />));
    expect(screen.queryByText('Apagar GameBox')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('Número da GameBox'), '266571276572');
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'João');
    await fireEvent.changeText(screen.getByLabelText('Porta'), '5');
    await fireEvent.press(save());
    expect(saveGamebox).toHaveBeenCalledWith(
      'u1',
      { number: '266571276572', name: 'João', stadium: { port: '5', sector: '', line: '', seat: '' }, pavilion: null },
      undefined,
      2,
      undefined,
    );
    expect(mockRouter.replace).toHaveBeenCalledWith('/gamebox');
  });

  it('lê o número que vem do leitor (?numero=)', async () => {
    mockParams.current = { id: 'nova', numero: '266571276572' };
    await render(wrap(<GameboxForm />));
    expect(screen.getByLabelText('Número da GameBox').props.value).toBe('266571276572');
    expect(save().props.accessibilityState.disabled).toBe(false);
  });

  it('o ícone de leitor abre /gamebox/ler com a origem', async () => {
    mockParams.current = { id: 'nova' };
    await render(wrap(<GameboxForm />));
    await fireEvent.press(screen.getByRole('button', { name: 'Ler código da GameBox' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/gamebox/ler?from=nova');
  });

  it('editar: mostra os dados decifrados, o pavilhão na segunda tab e guarda no mesmo documento', async () => {
    mockParams.current = { id: 'g1' };
    mockBoxes.current = ready([box('g1', 1, { gameboxName: 'João' })]);
    await render(wrap(<GameboxForm />));
    expect(screen.getByLabelText('Número da GameBox').props.value).toBe('266571276572');
    expect(screen.getByLabelText('Nome').props.value).toBe('João');
    expect(screen.getByLabelText('Sector').props.value).toBe('A27');
    await fireEvent.press(screen.getByRole('tab', { name: /Pavilhão/ }));
    expect(screen.getByLabelText('Sector').props.value).toBe('');
    await fireEvent.changeText(screen.getByLabelText('Sector'), 'A1');
    await fireEvent.press(screen.getByRole('button', { name: 'Ler código da GameBox' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/gamebox/ler?from=g1');
    await fireEvent.press(save());
    expect(saveGamebox).toHaveBeenCalledWith(
      'u1',
      {
        number: '266571276572',
        name: 'João',
        stadium: { port: '5', sector: 'A27', line: '18', seat: '24' },
        pavilion: { port: '', sector: 'A1', line: '', seat: '' },
      },
      { id: 'g1', order: 1 },
    );
  });

  it('editar com número lido pelo leitor substitui o guardado', async () => {
    mockParams.current = { id: 'g1', numero: '999999' };
    mockBoxes.current = ready([box('g1', 1)]);
    await render(wrap(<GameboxForm />));
    expect(screen.getByLabelText('Número da GameBox').props.value).toBe('999999');
  });

  // Task 24 (F12 revisto): o leitor volta a esta instância com dismissTo e só o parâmetro `numero` muda.
  it('nova: o que se escreveu antes de ler fica depois da volta do leitor; guardar não deixa outro formulário', async () => {
    mockParams.current = { id: 'nova' };
    mockBoxes.current = ready([]);
    const { rerender } = await render(wrap(<GameboxForm />));
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'João');
    await fireEvent.changeText(screen.getByLabelText('Porta'), '5');
    await fireEvent.press(screen.getByRole('button', { name: 'Ler código da GameBox' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/gamebox/ler?from=nova');
    mockParams.current = { id: 'nova', numero: '266571276572' };
    await rerender(wrap(<GameboxForm />));
    expect(screen.getByLabelText('Número da GameBox').props.value).toBe('266571276572');
    expect(screen.getByLabelText('Nome').props.value).toBe('João');
    expect(screen.getByLabelText('Porta').props.value).toBe('5');
    await fireEvent.press(save());
    expect(saveGamebox).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).toHaveBeenCalledWith('/gamebox');
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
  });

  it('editar: o número lido substitui o guardado e mantém o resto do que se escreveu', async () => {
    mockParams.current = { id: 'g1' };
    mockBoxes.current = ready([box('g1', 1, { gameboxName: 'João' })]);
    const { rerender } = await render(wrap(<GameboxForm />));
    await fireEvent.changeText(screen.getByLabelText('Nome'), 'Pai');
    mockParams.current = { id: 'g1', numero: '999999' };
    await rerender(wrap(<GameboxForm />));
    expect(screen.getByLabelText('Número da GameBox').props.value).toBe('999999');
    expect(screen.getByLabelText('Nome').props.value).toBe('Pai');
    expect(screen.getByLabelText('Sector').props.value).toBe('A27');
  });

  it('um numero inválido no parâmetro não apaga o número escrito', async () => {
    mockParams.current = { id: 'nova' };
    mockBoxes.current = ready([]);
    const { rerender } = await render(wrap(<GameboxForm />));
    await fireEvent.changeText(screen.getByLabelText('Número da GameBox'), '123456');
    mockParams.current = { id: 'nova', numero: 'abc' };
    await rerender(wrap(<GameboxForm />));
    expect(screen.getByLabelText('Número da GameBox').props.value).toBe('123456');
  });

  it('editar: título GAMEBOX, quatro campos do lugar e "Apagar GameBox" a vermelho', async () => {
    mockParams.current = { id: 'g1' };
    mockBoxes.current = ready([box('g1', 1, { gameboxName: 'Lugar anual' })]);
    await render(wrap(<GameboxForm />));
    expect(screen.getByText('GameBox')).toBeTruthy();
    for (const l of ['Porta', 'Sector', 'Fila', 'Lugar']) expect(screen.getByLabelText(l)).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Estádio' }).props.accessibilityState.selected).toBe(true);
    expect(screen.getByText('Apagar GameBox')).toHaveStyle({ color: '#F74C66' });
  });

  it('apagar pede confirmação e só apaga depois de confirmar', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    mockParams.current = { id: 'g1' };
    mockBoxes.current = ready([box('g1', 1)]);
    await render(wrap(<GameboxForm />));
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar GameBox' }));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(deleteGamebox).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]?.[2] as { text: string; style?: string; onPress?: () => void }[];
    expect(buttons.map((b) => b.text)).toEqual(['Cancelar', 'Apagar']);
    await act(async () => {
      await buttons[1]?.onPress?.();
    });
    expect(deleteGamebox).toHaveBeenCalledWith('g1');
    expect(mockRouter.replace).toHaveBeenCalledWith('/gamebox');
    alert.mockRestore();
  });

  it('sem rede ao guardar: mensagem clara e o formulário fica como estava', async () => {
    (saveGamebox as jest.Mock).mockRejectedValueOnce(new GameboxSaveError('OFFLINE'));
    mockParams.current = { id: 'g1' };
    mockBoxes.current = ready([box('g1', 1)]);
    await render(wrap(<GameboxForm />));
    await fireEvent.changeText(screen.getByLabelText('Porta'), '7');
    await fireEvent.press(save());
    expect(screen.getByText(/Sem ligação/)).toBeTruthy();
    expect(screen.getByLabelText('Porta').props.value).toBe('7');
    expect(mockRouter.replace).not.toHaveBeenCalled();
    expect(save().props.accessibilityState.disabled).toBe(false);
  });

  it('nova sem rede (tempo limite): repetir grava no mesmo documento; depois de UNKNOWN começa do zero', async () => {
    (saveGamebox as jest.Mock)
      .mockRejectedValueOnce(new GameboxSaveError('OFFLINE', 'auto7'))
      .mockRejectedValueOnce(new GameboxSaveError('UNKNOWN'));
    mockParams.current = { id: 'nova' };
    await render(wrap(<GameboxForm />));
    await fireEvent.changeText(screen.getByLabelText('Número da GameBox'), '266571276572');
    await fireEvent.press(save());
    await fireEvent.press(save());
    expect((saveGamebox as jest.Mock).mock.calls[1].slice(2)).toEqual([undefined, 1, 'auto7']);
    await fireEvent.press(save());
    expect((saveGamebox as jest.Mock).mock.calls[2].slice(2)).toEqual([undefined, 1, undefined]);
  });

  it('sem rede ao apagar: mensagem clara e fica no formulário', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    (deleteGamebox as jest.Mock).mockRejectedValueOnce(new GameboxSaveError('OFFLINE'));
    mockParams.current = { id: 'g1' };
    mockBoxes.current = ready([box('g1', 1)]);
    await render(wrap(<GameboxForm />));
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar GameBox' }));
    const buttons = alert.mock.calls[0]?.[2] as { onPress?: () => void }[];
    await act(async () => {
      await buttons[1]?.onPress?.();
    });
    expect(screen.getByText(/Sem ligação/)).toBeTruthy();
    expect(mockRouter.replace).not.toHaveBeenCalled();
    alert.mockRestore();
  });

  it('nova com a lista por ler: erro da secção, sem formulário (nunca grava com uma ordem inventada)', async () => {
    mockParams.current = { id: 'nova' };
    mockBoxes.current = { status: 'error', error: new Error('x') };
    await render(wrap(<GameboxForm />));
    expect(screen.getByText('Não foi possível carregar as tuas GameBox.')).toBeTruthy();
    expect(screen.queryByLabelText('Número da GameBox')).toBeNull();
    mockBoxes.current = { status: 'loading' };
    await render(wrap(<GameboxForm />));
    expect(screen.getByTestId('gamebox-form-loading')).toBeTruthy();
    expect(screen.queryByLabelText('Número da GameBox')).toBeNull();
  });

  it('GameBox inexistente ou leitura falhada: mensagem, sem formulário', async () => {
    mockParams.current = { id: 'zz' };
    mockBoxes.current = ready([box('g1', 1)]);
    await render(wrap(<GameboxForm />));
    expect(screen.getByText('Esta GameBox já não existe.')).toBeTruthy();
    expect(screen.queryByLabelText('Número da GameBox')).toBeNull();
    mockBoxes.current = { status: 'error', error: new Error('x') };
    await render(wrap(<GameboxForm />));
    expect(screen.getByText('Não foi possível carregar as tuas GameBox.')).toBeTruthy();
  });
});
