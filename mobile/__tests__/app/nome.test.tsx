// Task 16: ecrã do nome público. Serviço e dados mockados; expo-router global (jest.setup).
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockProfile: { current: unknown } = { current: { status: 'loading' } };
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'abcd1234', email: null, providers: ['password'] } }),
}));
jest.mock('@/data/hooks', () => ({ usePublicProfile: jest.fn(() => mockProfile.current) }));
jest.mock('@/services/profile', () => ({ updateDisplayName: jest.fn() }));

import { usePublicProfile } from '@/data/hooks';
import { updateDisplayName } from '@/services/profile';
import Nome, { NOME_HELPER } from '../../app/(app)/perfil/nome';

const METRICS = { frame: { x: 0, y: 0, width: 375, height: 812 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };
const ui = () => (
  <SafeAreaProvider initialMetrics={METRICS}>
    <Nome />
  </SafeAreaProvider>
);
const save = () => screen.getByRole('button', { name: 'Guardar' });

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile.current = { status: 'ready', data: { displayName: 'Leão 77', avatarId: null } };
});

it('mostra o nome público atual do utilizador', async () => {
  await render(ui());
  expect(usePublicProfile).toHaveBeenCalledWith('abcd1234');
  expect(screen.getByText('Leão 77')).toBeTruthy();
});

it('sem perfil publicado mostra o nome automático Sportinguista + fim do uid', async () => {
  mockProfile.current = { status: 'missing' };
  await render(ui());
  expect(screen.getByText(`Sportinguista #${'1234'}`)).toBeTruthy();
});

it('mostra a ajuda do frame 24, tal e qual', async () => {
  await render(ui());
  expect(NOME_HELPER).toBe('É o nome que aparece no Ranking. O nome completo e o email nunca aparecem.');
  expect(screen.getByText(NOME_HELPER)).toBeTruthy();
});

it('"Guardar" desativado com o campo vazio', async () => {
  await render(ui());
  expect(save().props.accessibilityState.disabled).toBe(true);
});

it('nome inválido desativa "Guardar" e mostra a mensagem', async () => {
  await render(ui());
  await fireEvent.changeText(screen.getByLabelText('Novo nome'), 'ab');
  expect(save().props.accessibilityState.disabled).toBe(true);
  expect(screen.getByText('O nome tem de ter pelo menos 3 caracteres.')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Novo nome'), 'ze@x.pt');
  expect(screen.getByText('O nome não pode ter @.')).toBeTruthy();
  await fireEvent.press(save());
  expect(updateDisplayName).not.toHaveBeenCalled();
});

it('nome válido: grava o valor normalizado e mostra o nome devolvido pelo servidor', async () => {
  (updateDisplayName as jest.Mock).mockResolvedValue('Leão Verde');
  await render(ui());
  await fireEvent.changeText(screen.getByLabelText('Novo nome'), '  Leão   Verde ');
  expect(save().props.accessibilityState.disabled).toBe(false);
  await fireEvent.press(save());
  expect(updateDisplayName).toHaveBeenCalledWith('Leão Verde');
  expect(screen.getByText('Leão Verde')).toBeTruthy();
  expect(screen.getByText('Nome guardado.')).toBeTruthy();
});

it('erro invalid-argument do servidor mostra a mensagem do código devolvido', async () => {
  (updateDisplayName as jest.Mock).mockRejectedValue(Object.assign(new Error('TOO_LONG'), { code: 'invalid-argument' }));
  await render(ui());
  await fireEvent.changeText(screen.getByLabelText('Novo nome'), 'Leão Verde');
  await fireEvent.press(save());
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(screen.getByText('O nome pode ter no máximo 20 caracteres.')).toBeTruthy();
  expect(screen.queryByText('Nome guardado.')).toBeNull();
});

it('dois toques rápidos gravam uma só vez', async () => {
  let resolve!: (v: string) => void;
  (updateDisplayName as jest.Mock).mockReturnValue(new Promise<string>((r) => (resolve = r)));
  await render(ui());
  await fireEvent.changeText(screen.getByLabelText('Novo nome'), 'Leão Verde');
  const btn = save() as unknown as { props: { onClick?: (e: unknown) => void } };
  const ev = { nativeEvent: {}, persist: () => {} };
  await act(async () => {
    btn.props.onClick?.(ev);
    btn.props.onClick?.(ev);
  });
  expect(updateDisplayName).toHaveBeenCalledTimes(1);
  await act(async () => resolve('Leão Verde'));
});
