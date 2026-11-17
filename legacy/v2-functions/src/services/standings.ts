import { Standings } from "../database/models/standings"
import { getStandings } from "../midleware/standings"
import { getCurrentSeason, STANDINGS_COMPETITION_IDS } from "../midleware/config"
import * as logger from "firebase-functions/logger";

const team = "228"

// Fetch + store standings. Defaults to the current season; pass a list to backfill.
// Documents are keyed by team_league_season so every season is kept (no overwrite),
// and there is no destructive wipe — old seasons are preserved.
export const StandingsScript = async (seasons: string[] = [getCurrentSeason()]) => {
  const standing = new Standings()

  await Promise.all(STANDINGS_COMPETITION_IDS.map(async league => {
    for (const season of seasons) {
      const response = await getStandings(league, season)
      await Promise.all(response.map(async (standings) => {
        try {
          const index = standings.league.standings.length > 0
            ? standings.league.standings.findIndex(x => x.filter(k => k.team.id === Number(team)).length > 0)
            : 0
          if (index < 0) {
            return;
          }
          await Promise.all(standings.league.standings[index].map(async data => {
            await standing.updateOrCreateStandings({
              api: data.team.id.toString() + "_" + league.toString() + "_" + season,
              season,
              points: String(data.points),
              rank: String(data.rank),
              goalsfor: String(data.all.goals.for),
              goalsagainst: String(data.all.goals.against),
              played: String(data.all.played),
              win: String(data.all.win),
              draw: String(data.all.draw),
              lose: String(data.all.lose),
              competition: league === 94 ? 'Primeira Liga' : league === 2 ? 'UEFA Champions League' : league === 97 ? 'Taça da Liga' : 'Taça de Portugal',
              team: {
                name: data.team.name,
                logo: data.team.logo,
                api: data.team.id.toString()
              },
            })
          }))
          logger.log(`Insert with success 💚 the standings for team ${team}, league ${league}, season ${season}`)
        } catch (error) {
          logger.error(`Error inserting standings for league ${league}, season ${season}: `, error)
        }
      }))
    }
  }))
}
