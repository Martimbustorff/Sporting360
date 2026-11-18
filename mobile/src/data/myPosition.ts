// Posição do próprio num período, contada no servidor (`fetchMyPosition`). Partilhado pelo Ranking (linha fixa
// quando está fora dos 100) e pelo Perfil ("Meu jogo").
import { useEffect, useState } from 'react';
import { fetchMyPosition, type PeriodKind } from './user';

/** `null` enquanto conta (ou sem `points`); `'error'` se a contagem falhar. Recontado quando os pontos mudam. */
export function useMyPosition(kind: PeriodKind, key: string, points: number | null): number | 'error' | null {
  const [state, setState] = useState<{ id: string; value: number | 'error' } | null>(null);
  const id = points === null ? null : `${kind}_${key}_${points}`;
  useEffect(() => {
    if (id === null || points === null) return undefined;
    let cancelled = false;
    fetchMyPosition(kind, key, points).then(
      (value) => {
        if (!cancelled) setState({ id, value });
      },
      () => {
        if (!cancelled) setState({ id, value: 'error' });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [id, kind, key, points]);
  return id !== null && state?.id === id ? state.value : null;
}
