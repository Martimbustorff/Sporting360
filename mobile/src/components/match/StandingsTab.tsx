// Figma: nós 500:29367 (jogo futuro) e 489:7432 (ao vivo), com o emblema por linha da variante 500:30076 (o
// Sporting com o emblema local 2026). A tab mostra a classificação da competição do jogo, ao vivo, com
// `CompetitionStandings` (tabela ou quadro das eliminatórias); a vista escolhida à mão fica para a sessão.
import { CompetitionStandings } from '@/components/CompetitionStandings';
import type { Match } from '@/data/schemas';

export function StandingsTab({ match }: { match: Match }) {
  return <CompetitionStandings key={match.competition.key} competitionKey={match.competition.key} />;
}
