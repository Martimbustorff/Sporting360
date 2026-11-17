import axios from "axios";
import { ISatisticsApI } from "./interface/Api/ISatisticsApi";
import { FOOTBALL_BASE_URL, footballHeaders } from "./config";

export const getStatistics = async (gameId: string) => {
  const { data } = await axios.get(
    `${FOOTBALL_BASE_URL}/fixtures/statistics?fixture=${gameId}`,
    { headers: footballHeaders() }
  )
  const statistics = data.response as ISatisticsApI[]
  return statistics
}
