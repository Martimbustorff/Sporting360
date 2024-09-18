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
  elapseTime:string
  timestamp:string
}
const PrincipalGameHome = ({competation,hometeam,uriLogo,jorney,awayteam,uriAwayLogo,timestamp,resultHome,resultaway,isStart,id,elapseTime}:IGame) => {
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
    <Animated.View entering={FadeIn.delay(1000)} sharedTransitionTag="sharedTag" className='w-80 mt-12 self-center bg-bgauth opacity-70 rounded-lg h-44'>
     
      <View className='w-full bg-white_20 h-8 rounded-lg justify-center items-center'>
        <Text className={`text-white font-dinBold ${Platform.OS === 'ios' && 'pt-2'}  text-lg `}>{competation}</Text>
      </View>
      <View className='w-full items-center flex-row mt-4  justify-center '>
          <View className='flex justify-center items-center w-1/3 flex-col gap-2'>
              <Image className='w-16  h-16 ' source={{uri:uriLogo}}  />
              <Text className='font-dinLight text-center h-15 flex-wrap text-xs pt-1 mt-2 mb-2 text-white'>
                {hometeam} 
              </Text>
          </View>
          <View className='flex flex-col w-1/3  items-center gap-2'>
            <View style={{backgroundColor:'#00835B'}} className=' justify-center mb-1 items-center rounded-full h-6 w-11'>
              <Text className={`font-dinBold  text-xs  text-white ${Platform.OS === 'ios' && 'leading-9 h-full pt-'}`}>J{jorney.trim()}</Text>
            </View>
            {isStart  ? 
            <View className=' justify-center mb-[-8]  items-center'>
                {!isStart ? <Text className='font-dinLight  text-xs  text-white'>
                  {formatDate()}
                </Text> : 
                <Text className='font-dinBold pb-[-8]  mt-2  text-xl  text-titleauth'>
                {elapseTime}´min
              </Text> 
                }
                <View className='w-20 flex-row mt-2  justify-between'>
                    <View className='bg-white w-9 mr-2 h-10 rounded-md justify-center items-center'>
                      <Text className={`font-dinBold  text-lg  text-bgauth ${Platform.OS === 'ios' && 'leading-9  pt-2'}`}>
                        {resultHome === null ? "0" : resultHome}
                      </Text>
                    </View>
                    <View className='bg-white w-9 h-10 rounded-md justify-center items-center'>
                    <Text className={`font-dinBold  text-lg  text-bgauth ${Platform.OS === 'ios' && 'leading-9  pt-2'}`}>
                        {resultaway === null ? "0" : resultaway}
                      </Text>
                    </View>
                </View>
            </View>
            : 
              <View className=' justify-center mb-[-3]  items-center'>
                <Text className='font-dinLight  text-xs  text-white'>
                  {formatDate()}
                </Text>
                <Text className='font-dinBold  text-xsm  text-white'>
                  {formatHour()}
                </Text>
              </View>
            }
              {!isStart && <View className=' bg-white_20 p-1  w-16 mt-4 h-8 pl-1 pr-1 rounded-full justify-center items-center'>
                <Text className={`font-dinBold  text-xs  text-white ${Platform.OS === 'ios' && 'leading-9'}`}>
                  SportTV1
                </Text>
              </View> }
          </View>
          <View className='flex justify-center items-center w-1/3 flex-col gap-2'>
              <Image className='w-16  h-16 ' resizeMode='contain' source={{uri:uriAwayLogo}}  />
              <Text className='font-dinLight text-center h-15 flex-wrap text-xs pt-1 mt-2 mb-2 text-white'>
                {awayteam}
              </Text>
          </View>
      </View>
    </Animated.View>  
</TouchableOpacity>
}

export default PrincipalGameHome;