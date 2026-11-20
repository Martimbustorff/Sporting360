// Tabs do detalhe de um jogo de futebol (rota app/(app)/jogo/[id].tsx). Sem React nem componentes.

export type MatchTabKey =
  | 'sumario'
  | 'videos'
  | 'estatisticas'
  | 'formacoes'
  | 'classificacao'
  | 'mvp';

/**
 * Tabs do detalhe de um jogo de futebol, por esta ordem. As outras modalidades não têm tabs. O prognóstico não tem
 * separador (Martim 20/11): é um cartão no Sumário antes do jogo; `?tab=prognostico` (links e push antigos) abre o Sumário.
 */
export const FOOTBALL_TABS: { key: MatchTabKey; label: string }[] = [
  { key: 'sumario', label: 'Sumário' },
  { key: 'videos', label: 'Vídeos' },
  { key: 'estatisticas', label: 'Estatísticas' },
  { key: 'formacoes', label: 'Formações' },
  { key: 'classificacao', label: 'Classificação' },
  { key: 'mvp', label: 'MVP' },
];
