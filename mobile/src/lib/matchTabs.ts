// Tabs do detalhe de um jogo de futebol (rota app/(app)/jogo/[id].tsx). Sem React nem componentes.

export type MatchTabKey =
  | 'sumario'
  | 'videos'
  | 'estatisticas'
  | 'formacoes'
  | 'classificacao'
  | 'prognostico'
  | 'mvp';

/** Tabs do detalhe de um jogo de futebol, por esta ordem. As outras modalidades não têm tabs. */
export const FOOTBALL_TABS: { key: MatchTabKey; label: string }[] = [
  { key: 'sumario', label: 'Sumário' },
  { key: 'videos', label: 'Vídeos' },
  { key: 'estatisticas', label: 'Estatísticas' },
  { key: 'formacoes', label: 'Formações' },
  { key: 'classificacao', label: 'Classificação' },
  { key: 'prognostico', label: 'Prognóstico' },
  { key: 'mvp', label: 'MVP' },
];
