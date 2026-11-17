// Importing necessary modules and functions
import { Lineups } from "../database/models/lineups"
import { getLineups } from "../midleware/lineups"
import { LineupResponse } from "../midleware/interface/Api/ILineup"
import { IGame } from "../interface/IGames"
import { resolveLiveGames } from "./helpers"
import * as logger from "firebase-functions/logger";

// Main function. Pass an explicit list of games to target them; omit it to process
// only the games that are currently live-relevant.
export const LineupsScript = async (games?: IGame[]) => {
  const targetGames = await resolveLiveGames(games)
  const lineup = new Lineups()

  // If games exist
  if(targetGames.length){
    // For each game
    await Promise.all(targetGames.map(async (game) => {
     let lineupsData: LineupResponse | null = null;
     try {
        // Fetching lineups data for the game
        lineupsData = await getLineups(game.api)
      } catch (error) {
        // Logging error if fetching summary fails
        logger.error(`Error getting summary for game ${game.api}: `, error)
        return;
      }
      
      try {
        // Deleting all summaries for the game
     
        // For each summary in the summary data
        await Promise.all(lineupsData.response.map(async (lineupitem) => {
          // Updating or creating a new summary in the database
          const result = await lineup.updateOrCreateLineups({
            GameId: game.api,
            id:lineupitem.team.id + "_" + game.api,
            startXI: (lineupitem.startXI || []).map((startXI) => {
              return {
                playerId: String(startXI.player.id),
                number: startXI.player.number,
                name: startXI.player.name,
                grid: startXI.player.grid,
                position: String(startXI.player.pos)
              }
            }),
            substitutes: (lineupitem.substitutes || []).map((substitute) => {
              return {
                playerId: String(substitute.player.id),
                number: substitute.player.number,
                name: substitute.player.name,
                grid: substitute.player.grid,
                position: String(substitute.player.pos)
              }
            }),
            teamId: String(lineupitem.team.id),
            // Keep the provider's declared formation as well as the player grid.
            // The grid drives the pitch UI, while this lets clients display the
            // formation name and provides useful data when player statistics are absent.
            formation: lineupitem.formation || "",
          })
          // Logging the result of the operation
          logger.log(`Insert with ${result ? 'success 💚' : 'error 💔'} the summary for game ${game.api}`)
        }))
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        // Logging error if inserting summary fails
        logger.error(`Error inserting summary for game ${game.api}: `, error)
      }
    }))
  }
}

