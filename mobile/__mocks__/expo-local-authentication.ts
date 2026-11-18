export const AuthenticationType = { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 } as const;
export const hasHardwareAsync = jest.fn(async () => true);
export const isEnrolledAsync = jest.fn(async () => true);
export const supportedAuthenticationTypesAsync = jest.fn(async () => [AuthenticationType.FACIAL_RECOGNITION]);
export const authenticateAsync = jest.fn(async () => ({ success: true }));
