// Importing necessary modules and functions
import { Videos } from "../database/models/videos"
import { getRounds, getVideosByGameId } from "../midleware/videos"
import { IVideosRespose } from "../midleware/interface/Api/IVideos"
import { IGame } from "../interface/IGames"
import { resolveLiveGames } from "./helpers"

// Main function. Pass an explicit list of games to target them; omit it to process
// only the games that are currently live-relevant.
export const VideosScript = async (gamesArg?: IGame[]) => {
  const games = await resolveLiveGames(gamesArg)
  const videos = new Videos()
  if (games.length) {
    // For each game

    let videosRounds1: IVideosRespose | null = null;
    let videosRounds7: IVideosRespose | null = null;
    let videosRounds9: IVideosRespose | null = null;
    try {
      // Fetching summary data for the game
      videosRounds1 = await getRounds("1")
      videosRounds7 = await getRounds("7")
      videosRounds9 = await getRounds("9")
    } catch (error) {
      // Logging error if fetching summary fails
      console.error(`Error getting summary for game: `, error)
      return;
    }
    const allMatches = [
      ...(videosRounds1?.matches || []),
      ...(videosRounds7?.matches || []),
      ...(videosRounds9?.matches || []),
    ];
    await Promise.all(games.filter(x => x.competition !== 'UEFA Champions League').map(async (game) => {
      console.log(`Starting to insert videos for game ${game.api}`)
      var date = game.timestamp.toDate();

      // Format the date to "DD/MM/YYYY"
      var day = String(date.getDate());
      var month = String(date.getMonth() + 1); // Months are zero-based
      var year = date.getFullYear();

      var formattedDate = day + '/' + month + '/' + year;

      console.log(formattedDate);

      console.log(formattedDate)
      try {
        await Promise.all(allMatches.filter(x => (game.competition !== "UEFA Champions League"  && (formattedDate === x.dt && (x.ateam.id === "6" || x.hteam.id === "6"))) && parseInt(game.api, 10) >= 1210619 && (x.ateam.id === "6" || x.hteam.id === "6")).map(async (match) => {
          // console.log(`Starting to insert videos for game ${game.api} and match ${match.id}`)
          const videosVsSports = await getVideosByGameId(match.id)
          // for each video insert in bd 
          await Promise.all(videosVsSports.vdos.map(async (video) => {
            const { title, links, minute, bigpic, type } = video
            if (type === 'goal' || type === 'resume' || type === 'flash') {
              console.log(`Starting to insert video ${title} for game ${game.api} and match ${match.id}`)

              try {
                const result = await videos.updateOrCreateVideos({
                  title,
                  videoUrl: links.embed,
                  minute,
                  GameId: game.api,
                  bigpicture: bigpic,
                  id: video.id.toString()
                })
                // Logging the result of the operation
                console.log(`Insert with ${result ? 'success 💚' : 'error 💔'} the video for game ${links.embed}`)
              } catch (error) {
                // Logging error if inserting summary fails
                console.error(`Error inserting video for game ${game.api}: `, error)
              }
            }
          }))
        }))
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        // Logging error if inserting summary fails
        console.error(`Error inserting video for game ${game.api}: `, error)
      }
    }))
  }
}