import { firebase } from "@react-native-firebase/firestore";

export interface IPlayers {
  GameId: string;
  id: string;
  teamId: string;
  Players: {
    playerId: string;
    name: string;
    photo: string;
    number: number;
    position: string;
    rating: string;
    goals: number;
    assists: number;
    saves: number;
    grid: string,
    passesAccuracy: string;
    tackles: number;
    foulsCommitted: number;
    cardsYellow: number;
    cardsRed: number;
    substitute: boolean;
    minutes: number;
  }[];
}
// get summaries from firebase by gameId
export const getPlayersByGameId = async (gameId:string):Promise<IPlayers[]> => {
  const document = firebase.firestore().collection('players').where('GameId', '==', gameId);
  const players =  await document.get()
  return players.docs.map(doc => doc.data()) as IPlayers[];
}