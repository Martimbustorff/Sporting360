// Movimento da app (20/11, Martim: "melhorar transições e efeitos de movimento"). Durações curtas (150 a 300 ms) e
// molas sem ressalto exagerado. O Reanimated respeita "Reduzir movimento" do sistema (`ReduceMotion.System`, o padrão):
// com a opção ligada as animações saltam para o fim. Só se anima quando muda o que se vê, nunca a cada leitura.
import * as Reanimated from 'react-native-reanimated';
import { Easing } from 'react-native-reanimated';

export const MOTION = {
  /** Toques, cores, pequenas mudanças. */
  fast: 150,
  /** Indicadores que deslizam, conteúdo que aparece. */
  base: 220,
  /** Barras e números que enchem. */
  slow: 320,
} as const;

/** Mola dos indicadores (sublinhado dos separadores, pílula da modalidade) e do cartão escolhido no MVP. */
export const SPRING = { damping: 20, stiffness: 240, mass: 0.7 } as const;

/** Saída suave (calculada quando se usa: alguns testes trocam o Reanimated por um mock sem `Easing`). */
export const easeOut = () => Easing.out(Easing.cubic);

/** Escala de um botão ou cartão enquanto está premido. */
export const PRESS_SCALE = 0.97;

/**
 * O Reanimated está disponível. Nos testes com `expo-router/testing-library` o módulo é trocado por um objeto vazio:
 * aí os componentes animados desenham a versão estática (o mesmo aspeto final, sem movimento).
 */
export const canAnimate = (): boolean => typeof (Reanimated as { useSharedValue?: unknown }).useSharedValue === 'function';
