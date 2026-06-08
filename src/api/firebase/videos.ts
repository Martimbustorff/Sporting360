import { firebase } from "@react-native-firebase/firestore";

export interface IVideos {
  title: string;
  videoUrl: string;
  minute:string;
  GameId: string;
  bigpicture: string;
  id: string;
}
// get videos from firebase by gameId
export const getVideosByGameId = async (gameId: string): Promise<IVideos[]> => {
  const document = firebase
    .firestore()
    .collection('videos')
    .where('GameId', '==', gameId);
  const videos = await document.get();
  return videos.docs.map((doc) => {
    const data = doc.data() as Record<string, any>;
    return {
      ...data,
      id: data.id ?? doc.id,
      // The VSPORTS API dropped the `vdo` field and now returns the embed
      // markup under `links.embed`. Accept whichever field the ingestion
      // layer wrote so video playback keeps working across the migration.
      videoUrl:
        data.videoUrl ?? data.links?.embed ?? data.embed ?? data.vdo ?? '',
    } as IVideos;
  });
};