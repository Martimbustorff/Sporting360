// Task 22: Editar perfil e Notificações. Hooks e serviço mockados; expo-router global (jest.setup).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AppState, Linking, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockUser: { current: unknown } = { current: { status: 'loading' } };
const mockSquad: { current: unknown } = { current: { status: 'loading' } };
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'u1', email: 'a@b.pt', providers: ['password'] } }),
}));
jest.mock('@/data/hooks', () => ({ useMyUser: jest.fn(() => mockUser.current) }));
jest.mock('@/services/push', () => ({ pushPermissionGranted: jest.fn(() => Promise.resolve(true)) }));
jest.mock('@/data/sports', () => ({ useTeamData: jest.fn(() => mockSquad.current) }));
jest.mock('@/services/userProfile', () => {
  class ProfileSaveError extends Error {
    saveCode: string;
    constructor(code: string) {
      super(code);
      this.saveCode = code;
    }
  }
  return { ProfileSaveError, updateMyProfileFields: jest.fn(() => Promise.resolve()) };
});

import { ProfileSaveError, updateMyProfileFields } from '@/services/userProfile';
import { pushPermissionGranted } from '@/services/push';
import EditarPerfil from '../../app/(app)/perfil/editar';
import Notificacoes from '../../app/(app)/perfil/notificacoes';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const wrap = (el: React.ReactElement) => <SafeAreaProvider initialMetrics={METRICS}>{el}</SafeAreaProvider>;
const save = () => screen.getByRole('button', { name: 'Guardar' });
const SQUAD = {
  status: 'ready',
  data: { players: [{ id: '1', name: 'Rui Silva', age: 30, number: 1, position: 'G', photo: null }, { id: '2', name: 'Morita', age: 29, number: 5, position: 'M', photo: null }] },
};

beforeEach(() => {
  jest.clearAllMocks();
  (pushPermissionGranted as jest.Mock).mockResolvedValue(true);
  mockUser.current = {
    status: 'ready',
    data: { name: 'Maria Costa', email: 'a@b.pt', memberNumber: '123', partnerNumber: '03/2008', seasonSeat: 'A1', favoriteSport: 'futsal' },
  };
  mockSquad.current = SQUAD;
});

describe('Editar perfil', () => {
  it('mostra os valores atuais, sem email nem nome completo, e Guardar desativado', async () => {
    await render(wrap(<EditarPerfil />));
    expect(screen.getByLabelText('Número de sócio').props.value).toBe('123');
    expect(screen.getByLabelText('Sócio desde (MM/AAAA)').props.value).toBe('03/2008');
    expect(screen.getByLabelText('Lugar anual').props.value).toBe('A1');
    expect(screen.getByRole('radio', { name: 'Futsal' }).props.accessibilityState.selected).toBe(true);
    expect(screen.queryByText('a@b.pt')).toBeNull();
    expect(save().props.accessibilityState.disabled).toBe(true);
  });

  it('o payload é só o que mudou e só chaves da lista', async () => {
    await render(wrap(<EditarPerfil />));
    await fireEvent.changeText(screen.getByLabelText('Lugar anual'), 'B2');
    await fireEvent.press(screen.getByRole('radio', { name: 'Futebol' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher jogador favorito' }));
    await fireEvent.press(screen.getByRole('radio', { name: 'Morita' }));
    await fireEvent.press(save());
    expect(updateMyProfileFields).toHaveBeenCalledWith('u1', {
      seasonSeat: 'B2',
      favoriteSport: 'football',
      favoritePlayer: { id: '2', name: 'Morita' },
    });
    expect(screen.getByText('Perfil guardado.')).toBeTruthy();
    expect(save().props.accessibilityState.disabled).toBe(true);
  });

  it('"Sócio desde" inválido (mês 13 ou futuro) mostra o erro e bloqueia Guardar', async () => {
    await render(wrap(<EditarPerfil />));
    await fireEvent.changeText(screen.getByLabelText('Sócio desde (MM/AAAA)'), '13/2020');
    expect(screen.getByText('Indica o mês e o ano no formato MM/AAAA, sem datas futuras.')).toBeTruthy();
    expect(save().props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Sócio desde (MM/AAAA)'), '01/2999');
    expect(save().props.accessibilityState.disabled).toBe(true);
    await fireEvent.changeText(screen.getByLabelText('Sócio desde (MM/AAAA)'), '05/2008');
    expect(save().props.accessibilityState.disabled).toBe(false);
  });

  it('número de sócio com letras bloqueia Guardar', async () => {
    await render(wrap(<EditarPerfil />));
    await fireEvent.changeText(screen.getByLabelText('Número de sócio'), '12ab');
    expect(screen.getByText('O número de sócio tem de ter entre 1 e 10 algarismos.')).toBeTruthy();
    expect(save().props.accessibilityState.disabled).toBe(true);
  });

  it('sem rede: mensagem clara e o formulário fica como estava', async () => {
    (updateMyProfileFields as jest.Mock).mockRejectedValueOnce(new ProfileSaveError('OFFLINE'));
    await render(wrap(<EditarPerfil />));
    await fireEvent.changeText(screen.getByLabelText('Lugar anual'), 'B2');
    await fireEvent.press(save());
    expect(screen.getByText(/Sem ligação/)).toBeTruthy();
    expect(screen.getByText(/As alterações vão ser enviadas quando houver ligação\./)).toBeTruthy();
    expect(screen.getByLabelText('Lugar anual').props.value).toBe('B2');
    expect(save().props.accessibilityState.disabled).toBe(false);
  });

  it('leitura falhada mostra erro, nunca o formulário', async () => {
    mockUser.current = { status: 'error', error: new Error('x') };
    await render(wrap(<EditarPerfil />));
    expect(screen.getByText('Não foi possível carregar o teu perfil.')).toBeTruthy();
    expect(screen.queryByLabelText('Número de sócio')).toBeNull();
  });

  it('plantel com erro mostra o erro do plantel', async () => {
    mockSquad.current = { status: 'error', error: new Error('x') };
    await render(wrap(<EditarPerfil />));
    await fireEvent.press(screen.getByRole('button', { name: 'Escolher jogador favorito' }));
    expect(screen.getByText('Não foi possível carregar o plantel.')).toBeTruthy();
  });

  it('jogador favorito atual mostra PlayerPhoto, o nome e "Mudar"', async () => {
    mockUser.current = { status: 'ready', data: { name: 'Maria Costa', favoritePlayer: { id: '2', name: 'Morita' } } };
    await render(wrap(<EditarPerfil />));
    expect(screen.getByTestId('favorite-player-photo')).toBeTruthy();
    expect(screen.getByText('Morita')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Jogador favorito: Morita. Mudar' })).toBeTruthy();
  });

  it('os chips de modalidade têm alvo de toque mínimo de 44 pt', async () => {
    await render(wrap(<EditarPerfil />));
    for (const name of ['Futsal', 'Futebol']) {
      const st = StyleSheet.flatten(screen.getByRole('radio', { name }).props.style);
      expect(st.minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it('documento inexistente abre o formulário vazio', async () => {
    mockUser.current = { status: 'missing' };
    await render(wrap(<EditarPerfil />));
    expect(screen.getByLabelText('Número de sócio').props.value).toBe('');
  });
});

describe('Notificações', () => {
  it('sem preferências guardadas mostra só dois interruptores, ligados, e o aviso', async () => {
    mockUser.current = { status: 'ready', data: {} };
    await render(wrap(<Notificacoes />));
    for (const l of ['Lembrete de prognóstico', 'Abertura do MVP']) {
      expect(screen.getByRole('switch', { name: l }).props.accessibilityState.checked).toBe(true);
    }
    expect(screen.getAllByRole('switch')).toHaveLength(2);
    for (const l of ['Início dos jogos', 'Golos', 'Notícias']) expect(screen.queryByRole('switch', { name: l })).toBeNull();
    expect(screen.getByText('Escolhe o que queres receber neste telemóvel enquanto tiveres sessão iniciada.')).toBeTruthy();
  });

  it('mostra o aviso novo e já não diz "numa próxima versão"', async () => {
    mockUser.current = { status: 'ready', data: {} };
    await render(wrap(<Notificacoes />));
    await act(async () => undefined);
    expect(screen.getByText('Escolhe o que queres receber neste telemóvel enquanto tiveres sessão iniciada.')).toBeTruthy();
    expect(screen.queryByText(/numa próxima versão/)).toBeNull();
    expect(screen.queryByText('As notificações estão desligadas nas definições do telemóvel.')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Abrir definições' })).toBeNull();
  });

  it('permissão recusada: mostra permissionOff e o botão chama Linking.openSettings', async () => {
    mockUser.current = { status: 'ready', data: {} };
    (pushPermissionGranted as jest.Mock).mockResolvedValue(false);
    const openSettings = jest.spyOn(Linking, 'openSettings').mockResolvedValue(undefined as never);
    await render(wrap(<Notificacoes />));
    await act(async () => undefined);
    expect(screen.getByText('As notificações estão desligadas nas definições do telemóvel.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir definições' }));
    expect(openSettings).toHaveBeenCalledTimes(1);
    openSettings.mockRestore();
  });

  it('volta a verificar a permissão quando a app regressa ao primeiro plano', async () => {
    mockUser.current = { status: 'ready', data: {} };
    (pushPermissionGranted as jest.Mock).mockResolvedValue(false);
    const remove = jest.fn();
    const original = AppState.addEventListener;
    const add = jest.fn(() => ({ remove }));
    AppState.addEventListener = add as never;
    const view = await render(wrap(<Notificacoes />));
    await act(async () => undefined);
    expect(screen.getByText('As notificações estão desligadas nas definições do telemóvel.')).toBeTruthy();
    const listener = (add.mock.calls as unknown as [string, (s: string) => void][]).find((c) => c[0] === 'change')![1];
    (pushPermissionGranted as jest.Mock).mockResolvedValue(true);
    await act(async () => listener('background'));
    expect(pushPermissionGranted).toHaveBeenCalledTimes(1);
    await act(async () => listener('active'));
    expect(pushPermissionGranted).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('As notificações estão desligadas nas definições do telemóvel.')).toBeNull();
    await view.unmount();
    expect(remove).toHaveBeenCalled();
    AppState.addEventListener = original;
  });

  it('mudar "Abertura do MVP" grava o objeto completo com mvpOpen false', async () => {
    mockUser.current = { status: 'ready', data: {} };
    await render(wrap(<Notificacoes />));
    await fireEvent.press(screen.getByRole('switch', { name: 'Abertura do MVP' }));
    expect(updateMyProfileFields).toHaveBeenCalledWith('u1', {
      notificationPrefs: { matchStart: true, goals: true, predictionReminder: true, mvpOpen: false, news: true },
    });
    expect(screen.getByRole('switch', { name: 'Abertura do MVP' }).props.accessibilityState.checked).toBe(false);
  });

  it('as chaves antigas guardadas mantêm o valor que tinham ao gravar', async () => {
    mockUser.current = { status: 'ready', data: { notificationPrefs: { matchStart: false, goals: true, predictionReminder: true, mvpOpen: true, news: false } } };
    await render(wrap(<Notificacoes />));
    await fireEvent.press(screen.getByRole('switch', { name: 'Lembrete de prognóstico' }));
    expect(updateMyProfileFields).toHaveBeenCalledWith('u1', {
      notificationPrefs: { matchStart: false, goals: true, predictionReminder: false, mvpOpen: true, news: false },
    });
  });

  it('dois toques seguidos acumulam as duas escolhas', async () => {
    mockUser.current = { status: 'ready', data: {} };
    await render(wrap(<Notificacoes />));
    await fireEvent.press(screen.getByRole('switch', { name: 'Abertura do MVP' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Lembrete de prognóstico' }));
    expect((updateMyProfileFields as jest.Mock).mock.calls[1][1]).toEqual({
      notificationPrefs: { matchStart: true, goals: true, predictionReminder: false, mvpOpen: false, news: true },
    });
  });

  it('erro ao guardar desfaz o interruptor e avisa', async () => {
    mockUser.current = { status: 'ready', data: {} };
    (updateMyProfileFields as jest.Mock).mockRejectedValueOnce(new ProfileSaveError('UNKNOWN'));
    await render(wrap(<Notificacoes />));
    await fireEvent.press(screen.getByRole('switch', { name: 'Abertura do MVP' }));
    expect(screen.getByRole('switch', { name: 'Abertura do MVP' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByText('Não foi possível guardar a escolha. Tenta outra vez.')).toBeTruthy();
  });

  it('sem rede mantém o interruptor e avisa', async () => {
    mockUser.current = { status: 'ready', data: {} };
    (updateMyProfileFields as jest.Mock).mockRejectedValueOnce(new ProfileSaveError('OFFLINE'));
    await render(wrap(<Notificacoes />));
    await fireEvent.press(screen.getByRole('switch', { name: 'Abertura do MVP' }));
    expect(screen.getByRole('switch', { name: 'Abertura do MVP' }).props.accessibilityState.checked).toBe(false);
    expect(
      screen.getByText('Sem ligação. A tua escolha fica guardada e é enviada quando houver ligação.'),
    ).toBeTruthy();
    expect(screen.getByRole('alert').props.children).not.toMatch(/neste telemóvel/);
  });

  it('snapshot da 1.ª escrita com a 2.ª ainda pendente não perde a 2.ª escolha', async () => {
    mockUser.current = { status: 'ready', data: {} };
    let finishSecond!: () => void;
    (updateMyProfileFields as jest.Mock)
      .mockImplementationOnce(() => Promise.resolve())
      .mockImplementationOnce(() => new Promise<void>((r) => (finishSecond = r)));
    const view = await render(wrap(<Notificacoes />));
    await fireEvent.press(screen.getByRole('switch', { name: 'Abertura do MVP' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Lembrete de prognóstico' }));
    // Chega o documento só com a 1.ª escrita (mvpOpen false); a 2.ª (predictionReminder false) ainda não foi confirmada.
    mockUser.current = { status: 'ready', data: { notificationPrefs: { matchStart: true, goals: true, predictionReminder: true, mvpOpen: false, news: true } } };
    await view.rerender(wrap(<Notificacoes />));
    expect(screen.getByRole('switch', { name: 'Lembrete de prognóstico' }).props.accessibilityState.checked).toBe(false);
    await fireEvent.press(screen.getByRole('switch', { name: 'Abertura do MVP' }));
    expect((updateMyProfileFields as jest.Mock).mock.calls[2][1]).toEqual({
      notificationPrefs: { matchStart: true, goals: true, predictionReminder: false, mvpOpen: true, news: true },
    });
    await act(async () => finishSecond());
  });

  it('erro na 1.ª escrita depois de uma 2.ª: desfaz só a 1.ª escolha', async () => {
    mockUser.current = { status: 'ready', data: {} };
    let failFirst!: (e: unknown) => void;
    (updateMyProfileFields as jest.Mock)
      .mockImplementationOnce(() => new Promise<void>((_r, j) => (failFirst = j)))
      .mockImplementationOnce(() => Promise.resolve());
    await render(wrap(<Notificacoes />));
    await fireEvent.press(screen.getByRole('switch', { name: 'Abertura do MVP' }));
    await fireEvent.press(screen.getByRole('switch', { name: 'Lembrete de prognóstico' }));
    await act(async () => failFirst(new ProfileSaveError('UNKNOWN')));
    expect(screen.getByRole('switch', { name: 'Abertura do MVP' }).props.accessibilityState.checked).toBe(true);
    expect(screen.getByRole('switch', { name: 'Lembrete de prognóstico' }).props.accessibilityState.checked).toBe(false);
  });

  it('chaves em falta nas preferências guardadas contam como desligadas', async () => {
    mockUser.current = { status: 'ready', data: { notificationPrefs: { matchStart: true, goals: false, predictionReminder: false, mvpOpen: false, news: false } } };
    await render(wrap(<Notificacoes />));
    expect(screen.getByRole('switch', { name: 'Abertura do MVP' }).props.accessibilityState.checked).toBe(false);
    expect(screen.getByRole('switch', { name: 'Lembrete de prognóstico' }).props.accessibilityState.checked).toBe(false);
  });

  it('leitura falhada mostra erro, não valores por omissão', async () => {
    mockUser.current = { status: 'error', error: new Error('x') };
    await render(wrap(<Notificacoes />));
    expect(screen.getByText('Não foi possível carregar as tuas preferências.')).toBeTruthy();
    expect(screen.queryByRole('switch', { name: 'Abertura do MVP' })).toBeNull();
  });
});
