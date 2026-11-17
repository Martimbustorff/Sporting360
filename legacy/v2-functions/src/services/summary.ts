// Importing necessary modules and functions
import { Summary } from "../database/models/summary"
import { getSummary } from "../midleware/summary"
import { ISummaryApi } from "../midleware/interface/Api/ISummaryApi"
import { IGame } from "../interface/IGames"
import { resolveLiveGames } from "./helpers"
import * as logger from "firebase-functions/logger";

// Main function. Pass an explicit list of games to target them; omit it to process
// only the games that are currently live-relevant.
export const SummaryScript = async (games?: IGame[]) => {
  const targetGames = await resolveLiveGames(games)
  const summaries = new Summary()

  // If games exist
  if (targetGames.length) {
    // For each game
    await Promise.all(targetGames.map(async (game) => {
      let summaryData: ISummaryApi | null = null;
      try {
        // Fetching summary data for the game
        summaryData = await getSummary(game.api)
      } catch (error) {
        // Logging error if fetching summary fails
        logger.error(`Error getting summary for game ${game.api}: `, error)
        return;
      }

      try {
        // Upsert the fresh events first, tracking the ids we wrote...
        const keepIds = new Set<string>();
        await Promise.all(summaryData.response.map(async (summary) => {
          const api = `${summary.player.id}_${summary.team.name}_${game.api}_${summary.detail}_${summary.time.elapsed}`;
          keepIds.add(api);
          // Updating or creating a new summary in the database
          const result = await summaries.updateOrCreateSummary({
            api,
            detail: summary.detail,
            GameId: game.api,
            playerSub: {
              name: summary.assist ? String(summary.assist.name) : "",
              api: summary.assist ? String(summary.assist.id) : "",
              logo: ""
            },
            player: {
              name: summary.player.name,
              api: String(summary.player.id),
              logo: ""
            },
            type: summary.type,
            team: {
              name: summary.team.name,
              api: String(summary.team.id),
              logo: summary.team.logo
            },
            time: String(summary.time.elapsed)
          })
          // Logging the result of the operation
          logger.log(`Insert with ${result ? 'success 💚' : 'error 💔'} the summary for game ${game.api}`)
        }))
        // ...then prune only the stale summaries that are no longer reported. This avoids
        // the previous delete-then-recreate gap where the game briefly had no events.
        await summaries.pruneStaleSummaries(game.api, keepIds)
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        // Logging error if inserting summary fails
        logger.error(`Error inserting summary for game ${game.api}: `, error)
      }
    }))
  }
}
