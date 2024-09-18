import { firebase } from "@react-native-firebase/firestore";

export interface ISummary {
  type:string,
  detail:string,
  team: {
    name: string;
    logo: string;
    api: string;
  };
  player: {
    name: string;
    logo: string;
    api: string;
  },
  playerSub: {
    name: string;
    logo: string;
    api: string;
  }
  api: string;
  time: string;
  GameId: string;
}
// get summaries from firebase by gameId
export const getSummariesByGameId = async (gameId:string):Promise<ISummary[]> => {
  const document = firebase.firestore().collection('summaries').where('GameId', '==', gameId);
  const summary =  await document.get()
  return summary.docs.map(doc => doc.data()) as ISummary[];
}