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

export function useTicketMode(): void {
  const focused = useIsFocused();

  useEffect(() => {
    if (!focused) return;
    let held = false;
    let saved: number | null = null;

    const engage = async () => {
      if (held) return;
      held = true;
      saved = null;
      try {
        const current = await Brightness.getBrightnessAsync();
        // Saiu (ou foi para segundo plano) enquanto o valor era lido: não se sobe nada.
        if (!held) return;
        saved = current;
        await Brightness.setBrightnessAsync(1);
      } catch {
        // Sem módulo ou sem permissão: o bilhete funciona na mesma.
      }
    };
    const release = () => {
      if (!held) return;
      held = false;
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
  }, [focused]);
}
