import axios, { AxiosResponse } from "axios";
import { IFixture } from "./interface/IFixture";
import { FOOTBALL_BASE_URL, FOOTBALL_TEAM, footballHeaders, getCurrentSeason } from "./config";

export const getGames = async (league: number, season: string = getCurrentSeason()) => {
  const { data }: AxiosResponse<IFixture> = await axios.get(
    `${FOOTBALL_BASE_URL}/fixtures?league=${league}&season=${season}&team=${FOOTBALL_TEAM}`,
    { headers: footballHeaders() }
  )
  return data
}

export const getGame = async (id: string) => {
  const { data } = await axios.get(
    `${FOOTBALL_BASE_URL}/fixtures?id=${id}`,
    { headers: footballHeaders() }
  )
  return data
}
