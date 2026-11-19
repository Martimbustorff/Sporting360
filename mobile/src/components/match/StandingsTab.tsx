// Figma V7.1: 4935:7111 (Classificação ao vivo). A tab mostra a classificação da competição do jogo com
// `CompetitionStandings` (tabela, com o alternador Ao vivo / Oficial quando há jogos a decorrer, ou quadro das
// eliminatórias); a vista escolhida à mão fica para a sessão. O `MatchScrollView` dentro dela mantém o colapso do cabeçalho.
import { CompetitionStandings } from '@/components/CompetitionStandings';
import type { Match } from '@/data/schemas';

export function StandingsTab({ match }: { match: Match }) {
  return <CompetitionStandings key={match.competition.key} competitionKey={match.competition.key} />;
}
