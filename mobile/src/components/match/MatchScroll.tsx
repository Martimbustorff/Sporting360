// SEM FIGMA (comportamento): o cabeçalho do jogo encolhe com o scroll do separador ativo (nota 06: "uma barra de 56 pt";
// nota 08: "os separadores ficam fixos"). Cada separador tem o seu ScrollView; este contexto recebe o `onScroll` de
// qualquer um deles e partilha o deslocamento com o cabeçalho. Fora do provider (um separador sozinho) é um no-op.
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { useSharedValue, type SharedValue } from 'react-native-reanimated';
import { layout } from '@/theme/tokens';

type Ctx = {
  y: SharedValue<number>;
  /** O cabeçalho compacto é o rótulo acessível (progresso acima de `collapseCompactFrom`). */
  compact: boolean;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
  reset: () => void;
};

const MatchScrollContext = createContext<Ctx | null>(null);

export function MatchScrollProvider({ children }: { children: ReactNode }) {
  const y = useSharedValue(0);
  const [compact, setCompact] = useState(false);
  const compactRef = useRef(false);
  const apply = useCallback(
    (offset: number) => {
      const v = Math.max(0, offset);
      y.set(v);
      const next = v / layout.collapseRange > layout.collapseCompactFrom;
      if (next !== compactRef.current) {
        compactRef.current = next;
        setCompact(next);
      }
    },
    [y],
  );
  const value = useMemo<Ctx>(
    () => ({ y, compact, onScroll: (e) => apply(e.nativeEvent.contentOffset.y), reset: () => apply(0) }),
    [y, compact, apply],
  );
  return <MatchScrollContext.Provider value={value}>{children}</MatchScrollContext.Provider>;
}

export function useMatchScrollContext(): Ctx | null {
  return useContext(MatchScrollContext);
}

/** Props de scroll para o ScrollView/FlatList de um separador: `<ScrollView {...useMatchScroll()} />`. */
export function useMatchScroll(): { onScroll?: Ctx['onScroll']; scrollEventThrottle: number } {
  const ctx = useContext(MatchScrollContext);
  return { onScroll: ctx?.onScroll, scrollEventThrottle: 16 };
}
