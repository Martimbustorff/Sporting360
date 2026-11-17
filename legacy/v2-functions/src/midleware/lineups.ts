import axios, { AxiosResponse } from "axios"
import { LineupResponse } from "./interface/Api/ILineup";
import { FOOTBALL_BASE_URL, footballHeaders } from "./config";

export const getLineups = async (gameId: string) => {
  const { data }: AxiosResponse<LineupResponse> = await axios.get(
    `${FOOTBALL_BASE_URL}/fixtures/lineups?fixture=${gameId}`,
    { headers: footballHeaders() }
  )
  return data
}
