// Plano 7, Tarefa 5: modo bilhete. Enquanto o ecrã tem o foco: brilho no máximo, ecrã sempre ligado e vertical.
// Brilho: guarda o valor ao entrar, sobe a 1, repõe ao perder o foco, ao desmontar e quando a app vai para segundo
// plano, e volta a subir (relendo o valor) ao ficar ativa. Os erros dos módulos nativos nunca partem o ecrã.
import { useEffect } from 'react';
import { AppState } from 'react-native';
import * as Brightness from 'expo-brightness';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useIsFocused } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';

export const TICKET_KEEP_AWAKE_TAG = 'gamebox-ticket';

const ignore = () => {};

/** `active` falso (ex.: o QR ainda não está no ecrã, ou o BiometricGate está por cima) não liga nada. */
export function useTicketMode(active = true): void {
  const focused = useIsFocused();

  useEffect(() => {
    if (!focused || !active) return;
    let held = false; // o ecrã quer o brilho no máximo
    let applied = false; // o máximo foi posto e há valor a repor
    let saved: number | null = null;
    let reading: Promise<void> | null = null;

    // O valor original lê-se uma só vez por "ciclo": um segundo engage com a leitura pendente espera por ela em vez de a repetir.
    const read = () => {
      reading ??= Brightness.getBrightnessAsync()
        .then((v) => {
          saved = v;
        })
        .catch(ignore)
        .finally(() => {
          reading = null;
        });
      return reading;
    };
    const engage = async () => {
      if (held) return;
      held = true;
      try {
        if (saved === null) await read();
        // Saiu (ou foi para segundo plano) enquanto o valor era lido: não se sobe nada.
        if (!held || applied || saved === null) return;
        applied = true;
        await Brightness.setBrightnessAsync(1);
      } catch {
        // Sem módulo ou sem permissão: o bilhete funciona na mesma.
      }
    };
    const release = () => {
      held = false;
      if (!applied) return;
      applied = false;
      const value = saved;
      saved = null;
      if (value !== null) Brightness.setBrightnessAsync(value).catch(ignore);
    };

    void engage();
    activateKeepAwakeAsync(TICKET_KEEP_AWAKE_TAG).catch(ignore);
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(ignore);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void engage();
      else release();
    });
    return () => {
      sub.remove();
      release();
      deactivateKeepAwake(TICKET_KEEP_AWAKE_TAG).catch(ignore);
      // A app inteira está bloqueada em vertical (app/_layout): "desbloquear" abriria a rotação, por isso repõe-se o bloqueio.
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(ignore);
    };
  }, [focused, active]);
}
