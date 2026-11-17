import { Games } from "../database/models/games"
import { getGames } from "../midleware/games"
import { FIXTURE_COMPETITIONS, getCurrentCalendarSeason, getSeasonsToSync } from "../midleware/config"
import type { IFixture } from "../midleware/interface/IFixture"
import { Timestamp } from "firebase/firestore";
import * as logger from "firebase-functions/logger";

// Fetch + store fixtures. Defaults to the current season (recurring scheduler); pass an
// explicit list of football seasons to backfill history. Friendlies use calendar-year
// seasons in API-Football, so they receive their own season list.
// Games are keyed by fixture id, which is unique across seasons.
export const GamesScript = async (
  seasons: string[] = getSeasonsToSync(),
  friendlySeasons: string[] = [getCurrentCalendarSeason()]
) => {
  const games = new Games()

  // Fetch competitions sequentially so a rate-limit/error for one competition
  // (including friendlies) cannot prevent the others from being refreshed.
  for (const competition of FIXTURE_COMPETITIONS) {
    const competitionSeasons = competition.seasonKind === "calendar" ? friendlySeasons : seasons;
    // Seasons sequentially within a league to keep the API request burst reasonable.
    for (const season of competitionSeasons) {
      let response: IFixture["response"] = [];
      try {
        ({ response } = await getGames(competition.id, season))
      } catch (error) {
        logger.error(`Error fetching fixtures for league ${competition.id}, season ${season}: `, error)
        continue;
      }
      await Promise.all(response.map(async (game) => {
        const { fixture, teams, goals, league } = game
        const { home, away } = teams
        const { id, date, status } = fixture
        const startTime = new Date(fixture.date);
        const endTime = new Date(startTime.getTime() + 150 * 60000);
        // convert 2023-11-26T18:00:00+00:00 to FirebaseTimeStamp
        var firebaseTimeStamp = Timestamp.fromDate(new Date(date));
        try {
          logger.info(league.round)
          const result = await games.updateOrCreateGame({
            api: id.toString(),
            timestamp: firebaseTimeStamp,
            teamhome: {
              name: home.name,
              logo: home.logo,
              api: home.id.toString()
            },
            teamaway: {
              name: away.name,
              logo: away.logo,
              api: away.id.toString()
            },
            scorehome: goals.home ? goals.home.toString() : '0',
            scoreaway: goals.away ? goals.away.toString() : '0',
            competition: league.name,
            season: league.season.toString(),
            channel: "",
            elapsedTime: status.elapsed ? status.elapsed.toString() : '0',
            journey: !league.round ? "" : league.round.split("-")[1] ? league.round.split("-")[1] : league.round,
            isActive: new Date() >= startTime && new Date() <= endTime,
            startTime: startTime.toISOString(),
            endTime: endTime.toISOString(),
          })

          logger.info(`Insert with ${result ? 'success 💚' : 'error 💔'} the game ${id.toString()} (${season}) league ${league.name}`)
        } catch (error) {
          logger.error(`Error inserting game ${id.toString()}: `, error)
        }
      }))
    }
  }
}
