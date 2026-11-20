// Vibração nos momentos-chave (20/11): submeter o prognóstico, votar no MVP, partilhar, abrir a GameBox, mudar de
// GameBox na catraca e golo de um jogo que estás a ver. Nunca lança: sem motor de vibração (simulador, web) não faz nada.
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

/** Intervalo entre as três vibrações do golo. */
const GOAL_PULSE_MS = 180;

const run = (fn: () => Promise<void>) => {
  if (Platform.OS === 'web') return;
  fn().catch(() => undefined);
};

export const haptic = {
  /** Toque leve: abrir, mudar de página. */
  light: () => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Escolha numa lista (MVP, + e − do prognóstico). */
  selection: () => run(() => Haptics.selectionAsync()),
  /** Ação concluída (prognóstico, voto, partilha) e golo. */
  success: () => run(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** Golo do Sporting (Plano 10): vibração tripla forte. */
  goal: () => {
    for (let i = 0; i < 3; i++) setTimeout(() => run(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)), i * GOAL_PULSE_MS);
  },
};
