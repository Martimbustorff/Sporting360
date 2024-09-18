import React from 'react';
import { View,Image,Text } from 'react-native';
import { ISummary } from '../../api/firebase/summary';

// import { Container } from './styles';
interface ISummaryDetailPage {
  summary : ISummary,
  teamHomeId:string,
}
const SummaryDetail: React.FC<ISummaryDetailPage> = ({summary,teamHomeId}) => {
  if(summary.type === 'Var'){
    return <View></View>
  }
  const returnImage = () =>{
    if(summary.detail === 'Yellow Card'){
      return require('../../assets/icons/yellowcard.png')
    }
    if(summary.detail === 'Red Card'){
      return require('../../assets/icons/redcard.png')
    }
    if(summary.type === 'subst'){
      return require('../../assets/icons/sub.png')
    }
    if(summary.type === 'Goal'){
      return require('../../assets/icons/goal.png')
    }
  }
  if(Number(teamHomeId) === Number(summary.team.api)){
    return <View className='w-auto mt-4 mb-2 flex-row items-center gap-4 justify-start'>
    <Text className='text-white font-dinBold  top-1 text-base'>{summary.time}´</Text>
    <View className='bg-white w-8 h-8 rounded-full p-3 justify-center items-center'>
     <Image className='w-5 h-5 object-contain' source={returnImage()}></Image>
    </View>
    <Text className='text-white font-dinLight top-1 text-base'>{summary.player.name}</Text>
  </View>
  }
  return <View className='w-auto mt-4 mb-2 flex-row items-center gap-4 justify-end'>
    <Text className='text-white font-dinLight top-1 text-base'>{summary.player.name}</Text>
    <View className='bg-white w-8 h-8 rounded-full p-3 justify-center items-center'>
     <Image className='w-5 h-5 object-contain' source={returnImage()}></Image>
    </View>
    <Text className='text-white font-dinBold  top-1 text-base'>{summary.time}´</Text>
  </View>;
}

export default SummaryDetail;