import React from 'react';
import { View,Text,Image } from 'react-native';
import { IStatisticsResponse } from '../../utils/graphql/query/statistics/IStatisticsResponse';
import { IStastistics } from '../../api/firebase/stastics';

// import { Container } from './styles';
interface IStatisticsProps{
  statistics : IStastistics[],
  homeTeamId : string
}
const Statistics: React.FC<IStatisticsProps> = ({statistics,homeTeamId}) => {
  const types = [
    {
     type:"Ball Possession",
     name:"Posse de Bola (%)",
    },
    {
      type:"expected_goals",
      name:"Golos Esperados",
     },
     {
      type:"Shots on Goal",
      name:"Remates à baliza",
     },
     {
      type:"Shots off Goal",
      name:"Remates não enquadrados"
     },
     {
      type:"Offsides",
      name:"Fora de Jogo"
     },
     {
      type:"Corner Kicks",
      name:"Cantos"
     },
     {
      type:"Fouls",
      name:"Faltas"
     },
     {
      type:"Yellow Cards",
      name:"Cartão amarelo"
     },
     {
      type:"Red Cards",
      name:"Cartão vermelho"
    }
  ]
  console.log(statistics)
  return <View className='flex flex-col w-96 pr-9 mt-4 h-full'>
    {types.map(x=>{
      let homeValue = "0"
      let awayValue = "0"
      try {
         homeValue = statistics?.filter(k=>Number(k?.team.api) === Number(homeTeamId) && String(k?.type) === String(x.type))[0].value
         awayValue = statistics?.filter(k=>Number(k?.team.api) !== Number(homeTeamId) && k?.type === x.type)[0].value
      } catch (error) {
        
      }
      return (
        <View className='justify-between flex-row w-full  border-b mb-4  border-b-white_20 pb-2'>
          <Text className={`text-white font-dinBold text-xl leading-9 w-14 pl-4 top-1`}>{ homeValue !==  "null" ? homeValue : "0"}</Text>
          {x.name === "Cartão amarelo" ?
           <View className='flex-row gap-2'>
             <Image className='w-4' source={require('../../assets/icons/yellowcard.png')} ></Image>
            <Text className='text-white font-dinRegular top-1  text-sm'>{x.name}</Text>
           </View>
          : x.name === "Cartão vermelho" ? 
          <View className='flex-row gap-2'>
          <Image className='w-4' source={require('../../assets/icons/redcard.png')} ></Image>
         <Text className='text-white font-dinRegular top-1  text-sm'>{x.name}</Text>
        </View>
          :  <Text className='text-white font-dinRegular top-1  text-sm'>{x.name}</Text>}
          <Text className='text-white font-dinBold text-xl leading-9 w-14 pr-4 top-1'>{ awayValue !==  "null" ? awayValue : "0" }</Text>
       </View>
      )
    })}
    <View className='h-60'></View>
        
  </View>;
}

export default Statistics