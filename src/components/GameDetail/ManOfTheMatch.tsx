import React, { useState } from 'react';
import { View,Text, ScrollView, Dimensions,StyleSheet,Image, Modal, TouchableOpacity } from 'react-native';
import { IStatisticsResponse } from '../../utils/graphql/query/statistics/IStatisticsResponse';
import { IStandingsResponse } from '../../utils/graphql/query/standings/IStandingsResponse';
import { IVideosResponse } from '../../utils/graphql/query/videos/IStatisticsResponse';
import WebView from 'react-native-webview';
import { Video, ResizeMode } from 'expo-av';
// import { Container } from './styles';
import { IVideos } from '../../api/firebase/videos';
import RNPoll, { IChoice } from "react-native-poll";
import { ILineups } from '../../api/firebase/lineups';
import { IManOfTheMatch, postManOfTheMatch } from '../../api/firebase/manOfTheMatch';
import auth from '@react-native-firebase/auth';
import { useNavigation } from '@react-navigation/native';

interface IManOfTheMatchProps {
  lineups: ILineups[];
  manOfTheMatch: IManOfTheMatch[];
  handleRefreshManofTheMatch:()=>void;
}
const ManOfTheMatch: React.FC<IManOfTheMatchProps> = ({lineups,manOfTheMatch,handleRefreshManofTheMatch}) => {
  console.log("HOME DO JOGO")
  console.log(manOfTheMatch)
  const {navigate} = useNavigation()
  const userId = auth().currentUser?.uid
  const choices:Array<IChoice> = lineups.length == 0 ?  [] : [...lineups.filter(x=>x.teamId == "228")[0].startXI, ...lineups.filter(x=>x.teamId == "228")[0].substitutes].filter(x=>x.name && x.name !== "" ).map(k=>{
      return {
        id:Number(k.playerId),
        votes:!manOfTheMatch ? 0 : manOfTheMatch.filter(x=>x.playerId === k.playerId).length,
        choice:k.name,
      } as IChoice
    })
  const [modalVisible,setModalVisible] = useState(false)
  return <View className='flex flex-col w-[85%] '>
     {lineups.length === 0 &&
      <View className='w-full h-40 ml-[-20] justify-center mt-0 items-center'>
      <Image source={require('../../assets/icons/calendarcheck.png')}></Image>
      <Text className='text-lg text-white font-bold font-dinLight'>Disponível no dia de jogo</Text>
      </View>}
      {lineups.length > 0 && 
      <>
       <Text className='text-lg mt-4  text-white font-bold font-dinBold'>🦁 MVP</Text>
       {!userId && <Text className='text-xs mt-2  text-white font-bold font-dinBold'>Para votar precisar estar autenticado</Text>}
      </>
      }
      <View className="mb-[-30] "></View>
      <RNPoll
        totalVotes={manOfTheMatch === null ?  0 : manOfTheMatch.length}
        percentageTextStyle={{color:'#ffff'}}
        choices={choices}
        pollId={1}
        choiceTextStyle={{color:'#ffff'}}
        checkMarkImageStyle={{tintColor:'#FFF'}}
        votedChoiceByID={manOfTheMatch ? Number(manOfTheMatch.filter(x=>x.id === userId).map(x=>x.playerId)[0]) : 0}
        hasBeenVoted={!manOfTheMatch ? false : manOfTheMatch.filter(x=>x.userId === userId).length > 0}
        onPress={()=>{
            if(!userId){
              navigate('Login')
            }
        }}
        text='Quem foi o melhor jogador?'
        onChoicePress={async (selectedChoice: IChoice)  =>{
            if(!userId){
              navigate('Login')
              return;
            }
            await postManOfTheMatch({
              GameId: lineups[0].GameId,
              playerId: selectedChoice.id.toString(),
              userId: userId,
              id: selectedChoice.id.toString() + "_" + userId,
            })
            handleRefreshManofTheMatch()
          }}
      />
      
    <View className='h-72 mb-40'></View>

  </View>;
}

export default ManOfTheMatch