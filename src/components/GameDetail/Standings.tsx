import React from 'react';
import { View,Text, ScrollView, Dimensions } from 'react-native';
import { IStatisticsResponse } from '../../utils/graphql/query/statistics/IStatisticsResponse';
import { IStandingsResponse } from '../../utils/graphql/query/standings/IStandingsResponse';
import { IStandings } from '../../api/firebase/standings';

const screenWidth = Dimensions.get('window').width;

// import { Container } from './styles';
interface IStandingsProps {
  standings: IStandings[]
}
const Standings: React.FC<IStandingsProps> = ({standings}) => {
  
  // const screenWidth = Dimensions.get('window').width; // Get the screen width dynamically
  // const padding = 18; // Adjust this value as per your `padding` styles
  // const containerWidth = screenWidth - padding; 

  const sortedStandings = standings.sort((a, b) => Number(a.rank) - Number(b.rank));
  return <View  className='flex flex-1 flex-col w-screen pr-10 mt-4 h-full'>

     <View className='w-full flex-row ml-1 border-b mb-4 p1-1 border-b-white_20 pb-2 mr-4'>
       <View className='w-[45%] flex-row'>
         <Text className='text-xl text-slate-400 top-1 font-dinCondensed'>#</Text>
         <Text className='text-xl ml-2 text-slate-400 top-1 font-dinCondensed'>EQUIPA</Text>
       </View>
       <View className='w-[55%] flex-row pr-1'>
         <Text className='text-xl text-slate-400 top-1 font-dinCondensed w-[14%] text-center'>J</Text>
         <Text className='text-xl text-slate-400 top-1 font-dinCondensed w-[14%] text-center'>V</Text>
         <Text className='text-xl text-slate-400 top-1 font-dinCondensed w-[14%] text-center'>E</Text>
         <Text className='text-xl text-slate-400 top-1 font-dinCondensed w-[15%] text-center'>D</Text>
         <Text className='text-xl text-slate-400 top-1 font-dinCondensed w-[28%] text-center'>G</Text>
         <Text className='text-xl text-slate-400 top-1 font-dinCondensed w-[15%] text-center'> P</Text>
       </View>
     </View>
     <ScrollView className="flex flex-1" contentContainerStyle={{marginLeft:0,marginBottom:40}}>
      {sortedStandings.length === 0 ? [] :sortedStandings.map(standing=>{
        return (
          <View className={`w-full pl-1 ${standing.team.name === "Sporting CP" && 'bg-titleauth pt-2 rounded-md'} border-b mb-4  border-b-white_20 pb-2 flex-row`}>
            <View className='w-[45%] flex-row items-center'>
              {standing.rank === "1" ?
                <View className='bg-primary rounded-full justify-center items-center w-7 h-7'>
                  <Text className='text-lg text-center top-1 text-white font-dinCondensed'>
                    {standing.rank}
                  </Text>
                </View>
              :
              standing.rank === "2" ? <View className='bg-gray-600 justify-center items-center rounded-full w-7 h-7'>
                  <Text className='text-lg text-white top-1 font-dinCondensed'>
                    {standing.rank}
                  </Text>
                </View>
              : standing.rank === "3" ? 
              <View className='bg-orange-900 rounded-full w-7 h-7 justify-center items-center'>
                  <Text className='text-lg text-white font-dinCondensed'>
                    {standing.rank}
                  </Text>
                </View>
              : <Text className='text-lg text-white ml-2 mr-3  top-1 font-dinCondensed'>
              {standing.rank}
              </Text> }
              <Text className='text-sm ml-2 text-white top break-words font-dinBold'>{standing.team.name}</Text>
            </View>
            <View className='w-[55%] flex-row items-center'>
              <Text className='text-lg text-white top font-dinCondensed w-[14%] text-center'>{standing.played}</Text>
              <Text className='text-lg text-white top font-dinCondensed w-[14%] text-center'>{standing.win}</Text>
              <Text className='text-lg text-white top font-dinCondensed w-[14%] text-center '>{standing.draw}</Text>
              <Text className='text-lg text-white top font-dinCondensed w-[15%] text-center'>{standing.lose}</Text>
              <Text className='text-lg text-white top font-dinCondensed w-[28%] text-center'> {standing.goalsfor}:{standing.goalsagainst}</Text>
              <Text className='text-lg text-white top font-dinCondensed w-[15%] text-center'>{standing.points}</Text>
            </View>
          </View>     
        )
      })}
     </ScrollView>
        
  </View>;
}

export default Standings