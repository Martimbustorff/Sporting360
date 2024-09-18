import React from 'react';
import { ScrollView, View,Text } from 'react-native';
import SummaryDetail from './SummaryDetails';
import { ISummary } from '../../api/firebase/summary';

// import { Container } from './styles';
interface ISummaryPage{
  summaries: ISummary[],
  teamHomeId:string,
}
const Summary: React.FC<ISummaryPage> = ({summaries,teamHomeId}) => {
  const goalHomeFristPart = summaries?.filter(x=>Number(x.time) <= 45 && x.team.api === teamHomeId && x.type=== 'Goal').length
  const goalAwayFristPart = summaries?.filter(x=>Number(x.time) <= 45 && x.team.api !== teamHomeId && x.type=== 'Goal').length 
 
  const goalHomeSecondPart = summaries?.filter(x=>Number(x.time) > 45 && x.team.api === teamHomeId && x.type=== 'Goal').length
  const goalAwaySecondPart = summaries?.filter(x=>Number(x.time) > 45 && x.team.api !== teamHomeId && x.type=== 'Goal').length
 

 return <ScrollView contentContainerStyle={{paddingRight:40}} >
    <View className='flex w-full flex-col mt-4 '>
      <View className='w-full bg-white_10 pl-3 pr-3 pt-2 pb-2 flex flex-row justify-between items-center rounded-md'>
        <Text className='text-white text-lg font-dinLight h-full top-1'>1ª Parte </Text>
        <Text className='text-white text-lg font-dinLight h-full top-1'>{goalHomeFristPart}-{goalAwayFristPart}</Text>
      </View>
      <View className='flex flex-col mt-4'>
          {summaries?.filter(x=>Number(x.time) <= 45).sort(function(a, b) {return Number(a.time) - Number(b.time)}).map(x=>{
          return (
            <SummaryDetail teamHomeId={teamHomeId} summary={x}></SummaryDetail>
          )
         })}
      </View>
    </View>
    <View className=' flex flex-col mt-4 mb-80'>
      <View className='w-full bg-white_10 pl-3 pr-3 pt-2 pb-2 flex flex-row justify-between items-center rounded-md'>
        <Text className='text-white text-lg font-dinLight h-full top-1'>2ª Parte </Text>
        <Text className='text-white text-lg font-dinLight h-full top-1'> {goalHomeSecondPart}-{goalAwaySecondPart}</Text>
      </View>
      <View className='flex flex-col mt-3'>
      {summaries?.filter(x=>Number(x.time) > 45).sort(function(a, b) {return Number(a.time) - Number(b.time)}).map(x=>{
          return (
            <SummaryDetail key={x.api} teamHomeId={teamHomeId} summary={x}></SummaryDetail>
          )
         })}
      </View>
    </View>
  </ScrollView>;
}

export default Summary;