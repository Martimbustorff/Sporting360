// Plano 8, Task 6: o destino do redirect depois de entrar fica fixo; um novo render do (auth) não o troca por `/`.
jest.mock('expo-router', () => ({ Redirect: jest.fn(() => null), Stack: () => null }));
const mockSession: { current: { status: 'loading' | 'signedOut' | 'signedIn' } } = { current: { status: 'signedOut' } };
jest.mock('@/providers/SessionProvider', () => ({ useSession: () => mockSession.current }));

import { render } from '@testing-library/react-native';
import { Redirect } from 'expo-router';
import { setPendingLink, takePendingLink } from '@/lib/pendingLink';
import AuthLayout from '../../app/(auth)/_layout';

beforeEach(() => {
  jest.clearAllMocks();
  takePendingLink();
  mockSession.current = { status: 'signedOut' };
});

it('mantém o link como destino nos renders seguintes (o pendente já foi consumido)', async () => {
  setPendingLink('/e/abc123');
  mockSession.current = { status: 'signedIn' };
  const { rerender } = await render(<AuthLayout />);
  expect(takePendingLink()).toBeNull();
  await rerender(<AuthLayout />);
  await rerender(<AuthLayout />);
  const hrefs = (Redirect as jest.Mock).mock.calls.map((c) => c[0].href);
  expect(hrefs.length).toBeGreaterThanOrEqual(3);
  expect(new Set(hrefs)).toEqual(new Set(['/emprestimo/abc123']));
});

it('sem link vai para / e uma sessão nova depois de sair não herda o destino anterior', async () => {
  setPendingLink('/e/abc123');
  mockSession.current = { status: 'signedIn' };
  const { rerender } = await render(<AuthLayout />);
  mockSession.current = { status: 'signedOut' };
  await rerender(<AuthLayout />);
  (Redirect as jest.Mock).mockClear();
  mockSession.current = { status: 'signedIn' };
  await rerender(<AuthLayout />);
  expect((Redirect as jest.Mock).mock.calls.at(-1)?.[0].href).toBe('/');
});
