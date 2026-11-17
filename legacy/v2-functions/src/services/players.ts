// Importing necessary modules and functions
import { Players } from "../database/models/players"
import { getPlayers } from "../midleware/players"
import { PlayerResponse } from "../midleware/interface/Api/IPlayer"
import { IGame } from "../interface/IGames"
import { resolveLiveGames } from "./helpers"
import * as logger from "firebase-functions/logger";
import { Lineups } from "../database/models/lineups";
import { Summary } from "../database/models/summary";

// Main function. Pass an explicit list of games to target them; omit it to process
// only the games that are currently live-relevant.
export const PlayersScript = async (games?: IGame[]) => {
  const targetGames = await resolveLiveGames(games)
  const player = new Players()
  const summary = new Summary()
  const lineup = new Lineups()
  // If games exist
  if (targetGames.length) {
    // For each game
    await Promise.all(targetGames.map(async (game) => {
      let playersData: PlayerResponse | null = null;
      try {
        // Fetching lineups data for the game
        playersData = await getPlayers(game.api)
      } catch (error) {
        // Logging error if fetching PlayerData- fails
        logger.error(`Error getting PlayerData for game ${game.api}: `, error)
        return;
      }

      // let summaryData: ISummaryApi | null = null;
      // try {
      //   // Fetching summary data for the game
      //   summaryData = await getSummary(game.api)
      // } catch (error) {
      //   // Logging error if fetching summary fails
      //   logger.error(`Error getting summary for game ${game.api}: `, error)
      //   return;
      // }
      try {
        const lineupData = await lineup.getLineUp(game.api);
        // Friendly fixtures frequently have lineups but no /fixtures/players
        // response. Persist a minimal roster from the lineup in that case so the
        // formation screen can still render the starting XI and its grid.
        if (playersData.response.length === 0 && lineupData.length > 0) {
          await Promise.all(lineupData.map(async (teamLineup) => {
            const roster = [
              ...teamLineup.startXI.map((member) => ({ ...member, substitute: false })),
              ...teamLineup.substitutes.map((member) => ({ ...member, substitute: true })),
            ];
            const result = await player.updateOrCreatePlayers({
              GameId: game.api,
              id: `${teamLineup.teamId}_${game.api}`,
              teamId: teamLineup.teamId,
              Players: roster.map((member) => ({
                playerId: member.playerId,
                number: member.number,
                name: member.name,
                photo: "",
                position: member.position,
                rating: "",
                goals: 0,
                assists: 0,
                saves: 0,
                passesAccuracy: "",
                tackles: 0,
                foulsCommitted: 0,
                cardsYellow: 0,
                cardsRed: 0,
                teamId: Number(teamLineup.teamId),
                grid: member.grid || "",
                minutes: 0,
                substitute: member.substitute,
              })),
            });
            logger.log(`Inserted lineup fallback (${result ? "success" : "error"}) for game ${game.api}`);
          }));
          return;
        }

        // For each PlayerData in the PlayerData data
        await Promise.all(playersData.response.map(async (playeritem) => {

          const teamLineup = lineupData.find(
            (lineup) => lineup.teamId === String(playeritem.team.id)
          );

          const substData = await summary.getSubstSummary(game.api)
          // For each player in the team
          // Updating or creating a new PlayerData in the database
          const result = await player.updateOrCreatePlayers({
            GameId: game.api,
            id: playeritem.team.id + "_" + game.api,
            teamId: playeritem.team.id,
            Players: playeritem.players.map((member) => {
              // A player may have no statistics entry yet (e.g. pre-match) — guard against it.
              const stats = member.statistics?.[0]
              const subPlayerGrid = substData.filter(subst => subst.playerSub.api === String(member.player.id))
              const playerInLineup = teamLineup?.startXI.find(
                (startXI) => startXI.playerId === String(stats?.games?.substitute === true ? subPlayerGrid[0]?.player.api : member.player.id))
              const playerInLineup1 = teamLineup?.startXI.find(
                (startXI) => startXI.playerId === String(member.player.id))
              logger.log(`the PlayerData for ${playerInLineup?.grid}:::`)
              return {
                playerId: String(member.player.id),
                number: stats?.games?.number,
                name: member.player.name,
                photo: member.player.photo,
                position: stats?.games?.position,
                rating: stats?.games?.rating,
                goals: stats?.goals?.total || 0,
                assists: stats?.goals?.assists,
                saves: stats?.goals?.saves,
                passesAccuracy: stats?.passes?.accuracy,
                tackles: stats?.tackles?.total,
                foulsCommitted: stats?.fouls?.committed,
                cardsYellow: stats?.cards?.yellow,
                cardsRed: stats?.cards?.red,
                teamId: playeritem.team.id,
                grid: playerInLineup?.grid ? playerInLineup.grid : (playerInLineup1?.grid ? playerInLineup1.grid : ""),
                minutes: stats?.games?.minutes,
                substitute: stats?.games?.substitute,
              }
            }),
          })
          // Logging the result of the operation
          logger.log(`Insert with ${result ? 'success 💚' : 'error 💔'} the PlayerData for game ${game.api}`)
        }));
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        // Logging error if inserting PlayerData fails
        logger.error(`Error inserting PlayerData for game ${game.api}: `, error)
      }
    }))
  }
}

