import { firebase } from "@react-native-firebase/firestore";

export interface IVideos {
  title: string;
  videoUrl: string;
  minute:string;
  GameId: string;
  bigpicture: string;
  id: string;
}
// get summaries from firebase by gameId
export const getVideosByGameId = async (gameId:string):Promise<IVideos[]> => {
  const document = firebase.firestore().collection('videos').where('GameId', '==', gameId);
  const videos =  await document.get();
  return videos.docs.map(doc => doc.data()) as IVideos[];
}