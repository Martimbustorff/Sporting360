import axios from "axios";
import { IStandingApi } from "./interface/Api/IStandingApi";
import { FOOTBALL_BASE_URL, footballHeaders, getCurrentSeason } from "./config";

export const getStandings = async (league: number, season: string = getCurrentSeason()) => {
  const { data } = await axios.get(
    `${FOOTBALL_BASE_URL}/standings?league=${league}&season=${season}`,
    { headers: footballHeaders() }
  )
  const standings = data.response as IStandingApi[]
  return standings
}
