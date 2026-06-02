import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { View,Image,Text,ScrollView, Dimensions, TouchableOpacity, Linking, Platform, StatusBar } from 'react-native';
import { CLubLogos } from '../../constants/ClubsLogo';
import moment from 'moment-timezone';
import { getLocales, getCalendars } from 'expo-localization';
import { DateTime } from 'luxon';
import Animated, { FadeIn } from 'react-native-reanimated';
interface IGame {
  competation: string;
  uriLogo:string,
  hometeam:string,
  uriAwayLogo:string,
  awayteam:string,
  id:number,
  resultHome?:string,
  resultaway?:string,
  jorney:string,
  isStart:boolean,
  elapseTime:string,
  timestamp:any,
  isActive: boolean,
  startTime?: string,
  endTime?: string
}
const PrincipalGameHome = ({competation,hometeam,uriLogo,jorney,awayteam,uriAwayLogo,timestamp,resultHome,resultaway,isStart,id,elapseTime,isActive, startTime, endTime}:IGame) => {
  const navigation = useNavigation()
  function formatDate() {
    const date = new Date(Number(timestamp.seconds) * 1000);
    const dayOfWeek = date.getDay();
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const dayOfMonth = date.getDate();
    const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const monthName = monthNames[date.getMonth()];
    const formattedDate = `${dayNames[dayOfWeek]}, ${dayOfMonth}`;
    return formattedDate;
  }

  function formatHour() {
    const date = new Date(Number(timestamp.seconds) * 1000);
   
    const formattedDate = `${date.getHours()}:${date.getMinutes().toString().length === 1  ? `${date.getMinutes()}0` : date.getMinutes()}`;
    return formattedDate;
  }

return <TouchableOpacity

      onPress={()=>{
        navigation.navigate("GameDetail",{
          id:id.toString()
        })
      }}
      activeOpacity={0.7}>
    <Animated.View entering={FadeIn.delay(1000)} sharedTransitionTag="sharedTag" className='w-[80%] mt-4 flex flex-col self-center bg-bgauth opacity-95 rounded-lg items-stretch h-[90%]'>
     
      <View className='w-full bg-white_20 h-[15%] rounded-lg justify-center items-center'>
        {!isStart?
        <Text className={`text-white font-dinBold ${Platform.OS === 'ios' && 'pt-2'}  text-lg `}>{competation}</Text>
        :<Text className={`text-white font-dinBold ${Platform.OS === 'ios' && 'pt-2'}  text-lg `}>Live</Text>
        }
      </View>
      <View className='w-full items-center flex-row justify-center pt-2 h-[85%]'>
          <View className='flex justify-center items-center w-1/3 flex-col gap-2 h-full'>
              <Image className='w-20  h-20 ' source={{uri:uriLogo}}  />
              <Text className='font-Poppins text-center h-15 flex-wrap text-sm pt-1 mt-2 ml-2 mb-2 text-white'>
                {hometeam} 
              </Text>
          </View>
          <View className='flex flex-col w-1/3 justify-between gap-2 items-center'>
            <View style={{backgroundColor:'#00835B'}} className=' justify-center mb-1 items-center rounded-full w-11'>
              <Text className={`font-dinBold  text-sm  text-white ${Platform.OS === 'ios' && 'leading-9 h-full pt-2'}`}>J{jorney.trim()}</Text>
            </View>
            {(isStart || isActive)  ? 
            <View className=' justify-center  items-center'>
                {!isStart ? <Text className='text-xs  text-white'>
                  {formatDate()}
                </Text> : 
                <Text className='font-dinBold text-xl text-titleauth'>
                {elapseTime}´min
              </Text> 
                }
                <View className='w-20 flex-row mt-3 justify-between'>
                    <View className='bg-white w-9 mr-2 h-10 rounded-md justify-center items-center'>
                      <Text className={`font-dinCondensed  text-3xl text-bold  text-bgauth ${Platform.OS === 'ios' && 'leading-9  pt-2'}`}>
                        {resultHome === null ? "0" : resultHome}
                      </Text>
                    </View>
                    <View className='bg-white w-9 h-10 rounded-md justify-center items-center'>
                    <Text className={`font-dinCondensed  text-3xl text-bold text-bgauth ${Platform.OS === 'ios' && 'leading-9  pt-2'}`}>
                        {resultaway === null ? "0" : resultaway}
                      </Text>
                    </View>
                </View>
            </View>
             : 
               <View className=' justify-center  items-center'>
                 <Text className='font-Poppins text-sm  text-white'>
                   {formatDate()}
                 </Text>
                 <Text className='font-dinCondensed mt-1 text-header  text-white'>
                   {formatHour()}
                 </Text>
               </View>
             }
               {!isStart && <View className=' bg-white_20 p-1  w-20 mt-1 h-8 pl-1 pr-1 rounded-full justify-center items-center'>
                 <Text className={`font-dinBold  text-sm  text-white ${Platform.OS === 'ios' && 'leading-9'}`}>
                   SportTV1
                 </Text>
               </View> }
          </View>
          <View className='flex justify-center items-center w-1/3 flex-col gap-2'>
              <Image className='w-20  h-20 ' resizeMode='contain' source={{uri:uriAwayLogo}}  />
              <Text className='font-Poppins text-center h-15 flex-wrap text-sm pt-1 mt-2 mb-2 text-white'>
                {awayteam}
              </Text>
          </View>
      </View>
    </Animated.View>  
</TouchableOpacity>
}

export default PrincipalGameHome;