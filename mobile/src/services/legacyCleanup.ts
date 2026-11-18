import { MMKV } from 'react-native-mmkv';

const DONE_KEY = 's360.legacyCleanupDone';

/**
 * Uma vez por instalação: a V2 guardava o passcode (`passcodecert`, instância por omissão) e o estado
 * persistido do zustand (instância `app-persist-storage`). A V7 usa Firebase Auth e biometria, por isso
 * apaga-se tudo isto. O marcador vive numa instância nova `s360`.
 */
export function legacyCleanup(): void {
  try {
    const own = new MMKV({ id: 's360' });
    if (own.getBoolean(DONE_KEY)) return;
    new MMKV().delete('passcodecert');
    new MMKV({ id: 'app-persist-storage' }).clearAll();
    own.set(DONE_KEY, true);
  } catch {
    // sem MMKV ou dados corrompidos: tenta-se outra vez no próximo arranque
  }
}
