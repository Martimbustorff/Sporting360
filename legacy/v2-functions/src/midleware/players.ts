import axios, { AxiosResponse } from "axios"
import { PlayerResponse } from "./interface/Api/IPlayer";
import { FOOTBALL_BASE_URL, footballHeaders } from "./config";

export const getPlayers = async (gameId: string) => {
  const { data }: AxiosResponse<PlayerResponse> = await axios.get(
    `${FOOTBALL_BASE_URL}/fixtures/players?fixture=${gameId}`,
    { headers: footballHeaders() }
  )
  return data
}
