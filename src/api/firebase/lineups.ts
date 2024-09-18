import { firebase } from "@react-native-firebase/firestore";

export interface ILineups {
  GameId: string;
  teamId: string;
  startXI : {
    playerId: string;
    name: string;
    position: string;
    number: number;
  }[];
  substitutes: {
    playerId: string;
    position: string;
    number: number;
  }[];
  id: string;
}
// get summaries from firebase by gameId
export const getLineupsByGameId = async (gameId:string):Promise<ILineups[]> => {
  const document = firebase.firestore().collection('lineups').where('GameId', '==', gameId);
  const lineups =  await document.get()
  return lineups.docs.map(doc => doc.data()) as ILineups[];
}