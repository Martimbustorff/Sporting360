// Plano 8: as consultas de empréstimos esperam permissão negada (app lançada antes das regras): não vai ao Crashlytics.
import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { onSnapshot } from '@react-native-firebase/firestore';
import { recordError } from '@react-native-firebase/crashlytics';
import { dismissOwnerLoanNotice, useOwnerLoanNotice, useOwnerLoans, useRecipientLoans } from '@/data/loans';
import { query, where } from '@react-native-firebase/firestore';

jest.mock('@react-native-firebase/app');
jest.mock('@react-native-firebase/auth');
jest.mock('@react-native-firebase/firestore');
jest.mock('@react-native-firebase/functions');
jest.mock('@react-native-firebase/crashlytics');
jest.mock('@react-native-firebase/analytics');
jest.mock('@react-native-firebase/app-check');
jest.mock('@/providers/SessionProvider', () => ({
  useSession: () => ({ status: 'signedIn', user: { uid: 'u1', email: 'a@b.pt', providers: ['password'] } }),
}));

const snapMock = onSnapshot as unknown as jest.Mock;
const lastError = (): ((e: Error) => void) => {
  const args = snapMock.mock.calls[snapMock.mock.calls.length - 1] as unknown[];
  return args.filter((a): a is (e: Error) => void => typeof a === 'function')[1] as (e: Error) => void;
};
const withCode = (code: string) => Object.assign(new Error('x'), { code });

function Owner() {
  return <Text testID="s">{useOwnerLoans('g1').status}</Text>;
}
function Recipient() {
  return <Text testID="s">{useRecipientLoans().status}</Text>;
}

beforeEach(() => {
  snapMock.mockClear().mockImplementation(() => jest.fn());
  (recordError as jest.Mock).mockClear();
});

describe.each([
  ['useOwnerLoans', Owner],
  ['useRecipientLoans', Recipient],
])('%s', (_name, C) => {
  it('permission-denied vira error sem ir ao Crashlytics', async () => {
    await render(<C />);
    await act(async () => lastError()(withCode('firestore/permission-denied')));
    expect(screen.getByTestId('s').props.children).toBe('error');
    expect(recordError).not.toHaveBeenCalled();
  });

  it('outros erros continuam a ser reportados', async () => {
    await render(<C />);
    await act(async () => lastError()(withCode('firestore/unavailable')));
    expect(recordError).toHaveBeenCalledTimes(1);
  });
});

describe('useOwnerLoanNotice', () => {
  const ts = (ms: number) => ({ toDate: () => new Date(ms) });
  const DAY = 86_400_000;
  const loanDoc = (id: string, extra: Record<string, unknown> = {}) => ({
    id,
    data: () => ({
      ownerUid: 'u1',
      gameboxId: 'g1',
      matchId: 'm1',
      match: { homeName: 'A', awayName: 'B', kickoff: ts(Date.now() + DAY), venue: 'stadium' },
      seat: { gate: null, sector: null, row: null, seat: null },
      createdAt: ts(Date.now() - DAY),
      expiresAt: ts(Date.now() + 2 * DAY),
      cancelledAt: ts(Date.now() - 1000),
      cancelReason: 'recipient-left',
      ...extra,
    }),
  });
  const deliver = async (docs: ReturnType<typeof loanDoc>[]) => {
    const args = snapMock.mock.calls[snapMock.mock.calls.length - 1] as unknown[];
    const next = args.find((a): a is (s: unknown) => void => typeof a === 'function')!;
    await act(async () => next({ docs, metadata: { fromCache: false } }));
  };
  function Notice() {
    const n = useOwnerLoanNotice('g1');
    return <Text testID="n">{n ? n.loanId : 'none'}</Text>;
  }

  it('lê só com igualdades (ownerUid e gameboxId), sem cancelledAt nem ordem', async () => {
    (query as jest.Mock).mockClear();
    (where as jest.Mock).mockClear();
    await render(<Notice />);
    const fields = (where as jest.Mock).mock.calls.map((c) => [c[0], c[1], c[2]]);
    expect(fields).toEqual([
      ['ownerUid', '==', 'u1'],
      ['gameboxId', '==', 'g1'],
    ]);
  });

  it('empréstimo cancelado com recipient-left e dentro da validade dá o aviso; fechar guarda e não volta', async () => {
    await render(<Notice />);
    await deliver([loanDoc('Lnotice1')]);
    expect(screen.getByTestId('n').props.children).toBe('Lnotice1');
    await act(async () => dismissOwnerLoanNotice('Lnotice1'));
    expect(screen.getByTestId('n').props.children).toBe('none');
  });

  it('o aviso fechado não volta numa montagem nova', async () => {
    const view = await render(<Notice />);
    await deliver([loanDoc('Lnotice1')]);
    expect(screen.getByTestId('n').props.children).toBe('none');
    await view.unmount();
  });

  it('outros motivos, sem motivo e expirados não dão aviso', async () => {
    await render(<Notice />);
    await deliver([
      loanDoc('La', { cancelReason: 'owner' }),
      loanDoc('Lb', { cancelReason: undefined }),
      loanDoc('Lc', { expiresAt: ts(Date.now() - 3_600_000) }),
      loanDoc('Ld', { cancelReason: 'owner-left' }),
    ]);
    expect(screen.getByTestId('n').props.children).toBe('none');
  });

  it('com vários, o mais recente', async () => {
    await render(<Notice />);
    await deliver([loanDoc('Lold', { createdAt: ts(Date.now() - 5 * DAY) }), loanDoc('Lnew', { createdAt: ts(Date.now() - 2 * DAY) })]);
    expect(screen.getByTestId('n').props.children).toBe('Lnew');
  });

  it('permissão negada: sem aviso e sem Crashlytics', async () => {
    (recordError as jest.Mock).mockClear();
    await render(<Notice />);
    await act(async () => lastError()(withCode('firestore/permission-denied')));
    expect(screen.getByTestId('n').props.children).toBe('none');
    expect(recordError).not.toHaveBeenCalled();
  });
});
