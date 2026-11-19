// O BiometricGate diz aqui se o bloqueio (ou a cobertura de privacidade) está por cima do conteúdo. Módulo à parte para os
// ecrãs que mexem no brilho ou no ecrã ligado (bilhete) não arrastarem o BiometricGate e os módulos nativos dele.
import { createContext, useContext } from 'react';

export const GateCoverContext = createContext(false);

/** Verdadeiro enquanto o bloqueio ou a cobertura de privacidade estão por cima do conteúdo. */
export function useGateCovered(): boolean {
  return useContext(GateCoverContext);
}
