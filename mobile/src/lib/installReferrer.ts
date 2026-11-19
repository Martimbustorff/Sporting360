// Plano 8, Task 7: empréstimo de GameBox para quem ainda não tem a app. O link /e/{id} manda o Android para a Play Store
// com `&referrer=loan%3D{id}`; no primeiro arranque a app lê aqui o referrer da instalação, uma só vez, e abre o
// empréstimo depois de entrar. Só Android (no iPhone a pessoa volta a tocar no link). Sem serviços de terceiros.
// O id nunca vai para logs nem para o Analytics.
import * as Application from 'expo-application';
import { MMKV } from 'react-native-mmkv';
import { Platform } from 'react-native';

const DONE_KEY = 's360.loanReferrerRead';
const FAILS_KEY = 's360.loanReferrerFails';
/** Falhas da API antes de desistir (aparelhos sem Play Store não devem chamar a API nativa em todos os arranques). */
const MAX_FAILS = 3;
/** Id de empréstimo: 22 caracteres base64url, dentro do referrer `loan=<id>` (sozinho ou entre outros parâmetros). */
const LOAN_PARAM = /(?:^|&)loan=([A-Za-z0-9_-]{22})(?:&|$)/;

/**
 * Id do empréstimo do referrer da instalação, ou `null`. Corre a leitura uma vez por instalação: depois de uma leitura
 * bem-sucedida (com ou sem `loan`) devolve sempre `null`. Um erro da API (ex.: serviço da Play indisponível) devolve
 * `null` e tenta outra vez no arranque seguinte; à 3.ª falha (contadas no MMKV) marca como lido e desiste.
 */
export async function readLoanReferrerOnce(): Promise<string | null> {
  if (Platform.OS !== 'android') return null;
  try {
    const store = new MMKV({ id: 's360' });
    if (store.getBoolean(DONE_KEY)) return null;
    let referrer: string;
    try {
      referrer = await Application.getInstallReferrerAsync();
    } catch {
      const fails = (store.getNumber(FAILS_KEY) ?? 0) + 1;
      store.set(FAILS_KEY, fails);
      if (fails >= MAX_FAILS) store.set(DONE_KEY, true);
      return null;
    }
    store.set(DONE_KEY, true);
    return LOAN_PARAM.exec(referrer ?? '')?.[1] ?? null;
  } catch {
    return null;
  }
}
