import axios, { AxiosResponse } from "axios"
import { ISummaryApi } from "./interface/Api/ISummaryApi";
import { FOOTBALL_BASE_URL, footballHeaders } from "./config";

export const getSummary = async (gameId: string) => {
  const { data }: AxiosResponse<ISummaryApi> = await axios.get(
    `${FOOTBALL_BASE_URL}/fixtures/events?fixture=${gameId}`,
    { headers: footballHeaders() }
  )
  return data
}
