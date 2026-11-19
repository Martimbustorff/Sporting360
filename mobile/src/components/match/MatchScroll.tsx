// SEM FIGMA (comportamento; notas 06 e 08): o cabeçalho completo fecha com o scroll do separador ativo e os separadores
// ficam fixos. Abordagem simples e determinística, com a janela de scroll constante:
//  - o cabeçalho completo e a barra de separadores formam um bloco sobreposto (position absolute) que sobe `min(y, H)` com
//    `translateY` (H = altura medida do cabeçalho completo); nunca se anima o layout, por isso a janela do ScrollView não muda;
//  - o conteúdo de cada separador vive numa janela com `paddingTop = H + altura dos separadores`; o `MatchScrollView` sobe
//    por baixo do bloco (marginTop negativo) e põe um espaçador do mesmo tamanho no início, para o conteúdo nascer por baixo
//    dos separadores e subir à mesma velocidade que o bloco (1:1). Estados sem scroll (vazio, a carregar) ficam por baixo
//    do bloco no sítio certo;
//  - `y` vem de `useAnimatedScrollHandler` (thread de UI); só o booleano `compact` volta ao JS, com histerese
//    (entra acima de collapseCompactFrom, sai abaixo de collapseCompactExit). Conteúdo curto não chega a deslocar nada.
// Fora do provider (um separador sozinho, a Classificação no ecrã da competição) o MatchScrollView é um ScrollView normal.
import { createContext, useCallback, useContext, useMemo, useState, type ComponentProps, type ReactNode } from 'react';
import Animated, { useAnimatedScrollHandler, useSharedValue, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { View } from 'react-native';
import { layout } from '@/theme/tokens';

/** Histerese do cabeçalho compacto: `prev` é o estado atual, `y` o scroll e `range` a altura do cabeçalho completo. */
export function nextCompact(prev: boolean, y: number, range: number): boolean {
  'worklet';
  const r = range > 0 ? range : layout.collapseRange;
  return prev ? y / r > layout.collapseCompactExit : y / r > layout.collapseCompactFrom;
}

type Ctx = {
  /** Scroll do separador ativo, na thread de UI. */
  y: SharedValue<number>;
  /** Altura medida do cabeçalho completo (0 enquanto não medida). */
  headerHeight: SharedValue<number>;
  /** O cabeçalho compacto é o rótulo acessível. */
  compact: boolean;
  /** Altura total sobreposta (cabeçalho completo + separadores) que o conteúdo reserva por cima. */
  inset: number;
  setHeaderHeight: (h: number) => void;
  setTabsHeight: (h: number) => void;
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
  /** Ao mudar de separador o cabeçalho volta a abrir. */
  reset: () => void;
};

const MatchScrollContext = createContext<Ctx | null>(null);

export function MatchScrollProvider({ children }: { children: ReactNode }) {
  const y = useSharedValue(0);
  const headerHeight = useSharedValue(0);
  const compactSV = useSharedValue(false);
  const [compact, setCompact] = useState(false);
  const [headerH, setHeaderH] = useState(0);
  const [tabsH, setTabsH] = useState(0);

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      'worklet';
      const v = Math.max(0, e.contentOffset.y);
      y.set(v);
      const next = nextCompact(compactSV.get(), v, headerHeight.get());
      if (next !== compactSV.get()) {
        compactSV.set(next);
        scheduleOnRN(setCompact, next);
      }
    },
  });
  const setHeaderHeight = useCallback(
    (h: number) => {
      headerHeight.set(h);
      setHeaderH(h);
    },
    [headerHeight],
  );
  const reset = useCallback(() => {
    y.set(0);
    compactSV.set(false);
    setCompact(false);
  }, [y, compactSV]);

  const value = useMemo<Ctx>(
    () => ({ y, headerHeight, compact, inset: headerH + tabsH, setHeaderHeight, setTabsHeight: setTabsH, onScroll, reset }),
    [y, headerHeight, compact, headerH, tabsH, setHeaderHeight, onScroll, reset],
  );
  return <MatchScrollContext.Provider value={value}>{children}</MatchScrollContext.Provider>;
}

export function useMatchScrollContext(): Ctx | null {
  return useContext(MatchScrollContext);
}

/**
 * ScrollView dos separadores do jogo: avisa o cabeçalho do scroll (thread de UI) e sobe por baixo do bloco sobreposto.
 * Sem provider comporta-se como um ScrollView normal.
 */
type ScrollProps = Omit<ComponentProps<typeof Animated.ScrollView>, 'children'> & { children?: ReactNode };

export function MatchScrollView({ children, style, ...rest }: ScrollProps) {
  const ctx = useMatchScrollContext();
  const inset = ctx?.inset ?? 0;
  return (
    <Animated.ScrollView
      scrollEventThrottle={16}
      {...rest}
      onScroll={ctx?.onScroll ?? rest.onScroll}
      style={[inset > 0 ? { marginTop: -inset } : null, style]}
    >
      {inset > 0 ? <View testID="match-scroll-spacer" style={{ height: inset }} /> : null}
      {children}
    </Animated.ScrollView>
  );
}
