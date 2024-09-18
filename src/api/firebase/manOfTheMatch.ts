import bottomSheet from "@gorhom/bottom-sheet/lib/typescript/components/bottomSheet";
import { firebase } from "@react-native-firebase/firestore";

export interface IManOfTheMatch {
  GameId: string;
  playerId: string;
  userId: string;
  id: string;
}
// get summaries from firebase by gameId
export const getManOfTheMatch = async (gameId:string):Promise<IManOfTheMatch[]> => {
  const document = firebase.firestore().collection('manofmatch').where('GameId', '==', gameId);
  const lineups =  await document.get()
  return lineups.docs.map(doc => doc.data()) as IManOfTheMatch[];
}

export const postManOfTheMatch = async (manOfTheMatch:IManOfTheMatch):Promise<boolean> => {
  const document = firebase.firestore().collection('manofmatch');
  await document.add(manOfTheMatch);
  return true;
}