import { firebase } from "@react-native-firebase/firestore";
export interface IStastistics {
  api: string
  game: string
  team: {
    name: string
    logo: string
    api: string
  },
  type: string
  value: string
}

// get stastistics from firebase by gameId
export const getStastisticsByGameId = async (gameId:string):Promise<IStastistics[]> => {
  const document = firebase.firestore().collection('stastistics').where('GameId', '==', gameId);
  const stastistics =  await document.get()
  return stastistics.docs.map(doc => doc.data()) as IStastistics[];
}