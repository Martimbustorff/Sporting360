// Importing necessary modules and functions
import { Statistics } from "../database/models/statistics"
import { ISatisticsApI } from "../midleware/interface/Api/ISatisticsApi"
import { getStatistics } from "../midleware/statistics"
import { IGame } from "../interface/IGames"
import { resolveLiveGames } from "./helpers"
import * as logger from "firebase-functions/logger";

// Main function. Pass an explicit list of games to target them; omit it to process
// only the games that are currently live-relevant (avoids re-fetching the whole history).
export const StatisticsScript = async (games?: IGame[]) => {
  const targetGames = await resolveLiveGames(games)
  const statistics = new Statistics()

  // If games exist
  if(targetGames.length){
    // For each game
    await Promise.all(targetGames.map(async (game) => {
      await new Promise(resolve => setTimeout(resolve, 2000));
     let statisticsData: ISatisticsApI[] | null = null;
     try {
        // Fetching statistics data for the game
        statisticsData = await getStatistics(game.api)
      } catch (error) {
        // Logging error if fetching summary fails
        console.error(`Error getting summary for game ${game.api}: `, error)
        return;
      }
      
      try {
        // For each statiscs in the summary data
        await Promise.all(statisticsData.map(async (statisticsitem) => {
          for (let i = 0; i < statisticsitem.statistics.length; i++) {
            // Updating or creating a new statiscs in the database
            await statistics.updateOrCreateStatistics({
              api: statisticsitem.team.id.toString() + "_" + String(game.api)  + "_" + statisticsitem.statistics[i].type ,
              GameId: game.api,
              team: {
                name: statisticsitem.team.name,
                logo: statisticsitem.team.logo,
                api: statisticsitem.team.id.toString()
              },
              type: statisticsitem.statistics[i].type,
              value: statisticsitem.statistics[i] ? String(statisticsitem.statistics[i].value) : ""
            })
           logger.log(`Insert with success 💚 the statistics for game ${game.api} `)
          }
         logger.log(`Insert with success 💚 the statistics for game ${game.api} `)
        }))
      } catch (error) {
        // Logging error if inserting summary fails
        logger.error(`Error inserting summary for game ${game.api}: `, error)
      }
    }))
  }
}


