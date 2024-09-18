import { IGamesResponse } from "./graphql/query/games/IGamesResponse";

 export const calendarData = (data:IGamesResponse)=>{
  const now = new Date(); 
  const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate()); // Get the current date without the time
  if(!data){
    return {nextGame:null,featureGames:[],lastGames:[]}
  }
  const nextGame = data?.games?.data
  .filter(obj => {
    const gameDate = new Date(Number(obj.attributes.Timestamp) * 1000);
    const gameDateWithoutTime = new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate());
    return gameDateWithoutTime >= currentDate;
  }).sort((a, b) => Number(a.attributes.Timestamp) - Number(b.attributes.Timestamp))[0]

  const featureGames = data?.games?.data.filter(obj => {
    const gameDate = new Date(Number(obj.attributes.Timestamp) * 1000);
    const gameDateWithoutTime = new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate());
    return gameDateWithoutTime >= currentDate;
  }).sort((a, b) => {
    const timestampA = Number(a.attributes.Timestamp);
    const timestampB = Number(b.attributes.Timestamp);
    
    return   timestampA - timestampB;
})
  try {
    featureGames.shift()
    
  } catch (error) {
    
  }

  let lastGames = data?.games?.data.filter(obj => {
    const gameDate = new Date(Number(obj.attributes.Timestamp) * 1000);
    const gameDateWithoutTime = new Date(gameDate.getFullYear(), gameDate.getMonth(), gameDate.getDate());
    return gameDateWithoutTime < currentDate;
  }).sort((a, b) => {
    const timestampA = Number(a.attributes.Timestamp);
    const timestampB = Number(b.attributes.Timestamp);
    
    return timestampB - timestampA;
})
  return {nextGame,featureGames,lastGames}
 }
 
 