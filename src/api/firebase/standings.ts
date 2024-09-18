import { firebase } from "@react-native-firebase/firestore";

export interface IStandings {
  rank: string
  team: {
    name: string
    logo: string
    api: string
  },
  api:string  
  points: string
  competition: string
  played: string
  win: string
  draw: string
  lose: string
  goalsfor: string
  goalsagainst: string
}

// get stastistics from firebase by competition
export const getStandingsByCompetation = async (competition:string):Promise<IStandings[]> => {
  const document = firebase.firestore().collection('standings').where('competition', '==', competition);
  const standings =  await document.get()
  return standings.docs.map(doc => doc.data()) as IStandings[];
}