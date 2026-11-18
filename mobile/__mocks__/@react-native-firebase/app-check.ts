export class ReactNativeFirebaseAppCheckProvider {
  providerOptions: unknown;
  configure = jest.fn((options: unknown) => {
    this.providerOptions = options;
  });
}
export const initializeAppCheck = jest.fn(() => ({ __mock: 'appCheck' }));
