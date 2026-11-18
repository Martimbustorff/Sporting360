export const getAuth = jest.fn(() => ({ __mock: 'auth' }));
export const connectAuthEmulator = jest.fn();
export const onAuthStateChanged = jest.fn(() => jest.fn());
export const createUserWithEmailAndPassword = jest.fn();
export const signInWithEmailAndPassword = jest.fn();
export const sendPasswordResetEmail = jest.fn();
export const signOut = jest.fn(() => Promise.resolve());
export const signInWithCredential = jest.fn();
export const linkWithCredential = jest.fn();
export const getAdditionalUserInfo = jest.fn(
  (cred: { additionalUserInfo?: unknown } | null) => cred?.additionalUserInfo ?? null,
);
export const GoogleAuthProvider = {
  PROVIDER_ID: 'google.com',
  credential: jest.fn((idToken?: string | null) => ({ providerId: 'google.com', token: idToken })),
};
export class OAuthProvider {
  providerId: string;
  constructor(providerId: string) {
    this.providerId = providerId;
  }
  credential(opts: { idToken?: string; rawNonce?: string }) {
    return { providerId: this.providerId, token: opts.idToken, secret: opts.rawNonce };
  }
}
// Task 16: reautenticação e revogação do token Apple (apagar conta).
export const reauthenticateWithCredential = jest.fn(() => Promise.resolve({ user: {} }));
export const revokeToken = jest.fn(() => Promise.resolve());
export const EmailAuthProvider = {
  PROVIDER_ID: 'password',
  credential: jest.fn((email: string, password: string) => ({ providerId: 'password', token: email, secret: password })),
};
