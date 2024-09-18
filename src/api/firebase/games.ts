import { firebase } from "@react-native-firebase/firestore";

export interface IGame {
  id: string;
  competition: string;
  timestamp: string;
  channel: string;
  journey: string;
  scorehome: string;
  scoreaway: string;
  api: string;
  elapsedTime: string;
  teamhome: {
    name: string;
    logo: string;
    api: string;
  };
  teamaway: {
    name: string;
    logo: string;
    api: string;
  };
}

//get game from firebase by where GameId
export const getGameById = async (gameId:string):Promise<IGame> => {
  const document =  firebase.firestore().collection('games').where('api', '==', gameId);
  const game =  await document.get()
  console.log("HERE")
  console.log({...game.docs[0].data(),id:game.docs[0].id})
  return {...game.docs[0].data(),id:game.docs[0].id} as IGame;
}

// get games from firebase
export const getNextGame = async ():Promise<IGame> => {
  // Get the next date based on timestamp 
  const date = new Date();
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const firebaseTimeStamp = firebase.firestore.Timestamp.fromDate(startOfDay);
  const document =  firebase.firestore().collection('games').where('timestamp', '>=', firebaseTimeStamp).orderBy('timestamp').limit(1);
  const game =  await document.get()
  return game.docs[0].data() as IGame;
}

// get games from firebase excluding the next game
export const getFeatureGames = async ():Promise<IGame[]> => {
  var firebaseTimeStamp = firebase.firestore.Timestamp.fromDate(new Date());
  const document =  firebase.firestore().collection('games').where('timestamp', '>=', firebaseTimeStamp).orderBy('timestamp');
  const games =  await document.get()
  games.docs.shift()
  return games.docs.map(doc => doc.data()) as IGame[];
}

// get previus games from firebase
export const getLastGames = async ():Promise<IGame[]> => {
  var firebaseTimeStamp = firebase.firestore.Timestamp.fromDate(new Date());
  const document =  firebase.firestore().collection('games').where('timestamp', '<', firebaseTimeStamp).orderBy('timestamp','desc');
  const games =  await document.get()
  return games.docs.map(doc => doc.data()) as IGame[];
}