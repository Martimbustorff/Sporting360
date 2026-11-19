// Plano 8: as consultas de empréstimos esperam permissão negada (app lançada antes das regras): não vai ao Crashlytics.
import React from 'react';
import { Text } from 'react-native';
import { act, render, screen } from '@testing-library/react-native';
import { onSnapshot } from '@react-native-firebase/firestore';
import { recordError } from '@react-native-firebase/crashlytics';
import { useOwnerLoans, useRecipientLoans } from '@/data/loans';

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
