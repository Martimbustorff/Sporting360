import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { View,Image,Text,ScrollView, Dimensions, TouchableOpacity, Linking, Platform, StatusBar } from 'react-native';
import Animated, { FadeInUp, interpolateColor, useAnimatedStyle, useSharedValue, withTiming }  from 'react-native-reanimated';
import { CLubLogos } from '../../constants/ClubsLogo';
import moment from 'moment-timezone';
import { getLocales, getCalendars } from 'expo-localization';
import { DateTime } from 'luxon';
interface IGame {
  hometeam: string;
  awaiTeam: string;
  date: string;
  hour: string;
  jorney: string;
  result:string
}
const Game = ({hometeam,awaiTeam,date,hour,jorney,result}:IGame) => {

  const detectedTimezone = getCalendars()[0].timeZone;

  function convertTimezone(baseDateTime) {
    const baseDate = DateTime.fromSQL(baseDateTime, { zone: 'Europe/Lisbon' });
    const convertedDate = baseDate.setZone(detectedTimezone);
    return convertedDate.toFormat("HH:mm");
  }
  
  const convertedTime = hour === 'N/D' ? null : convertTimezone(`2023-08-20 ${hour}`);

return  <View className=' p-2  pl-5 pr-5  border-b-[1px] border-white_20 w-full flex-row  justify-between items-center'>
        <View className='flex justify-center items-center w-1/3 flex-col gap-2'>
         {CLubLogos.filter(x=>x.name == String(hometeam).trim()).length > 0 && 
              <Image className='w-16 mt-[-8] ml-[-2] h-16 rounded-full' source={CLubLogos.filter(x=>x.name == String(hometeam).trim())[0].logo}  />
          }
          <Text className='font-dinLight text-center h-15 flex-wrap text-sm pt-1 mt-2 mb-2 text-white'>
            {hometeam}
          </Text>
        </View>
        <View className='flex flex-col w-1/3  justify-center items-center gap-2'>
          <View style={{backgroundColor:'#00835B'}} className=' justify-center items-center rounded-full h-10 w-10'>
            <Text className={`font-dinBold  text-xs  text-white ${Platform.OS === 'ios' && 'leading-10 h-full pt-1'}`}>J{jorney}</Text>
          </View>
          <Text className='font-dinLight  text-sm  text-white'>
            {date}
          </Text>
          <Text className={`font-dinBold  text-2xl  text-white ${Platform.OS === 'ios' && 'leading-9'}`}>
           {result ?
                result
            : convertedTime ? convertedTime : 'N/D'}
          
          </Text>
        
        </View>
        <View className='flex justify-center items-center w-1/3 flex-col gap-2'>
         {CLubLogos.filter(x=>x.name == String(awaiTeam).trim()).length > 0 && 
              <Image className='w-16 mt-[-8] ml-[-2] h-16 rounded-full' source={CLubLogos.filter(x=>x.name == String(awaiTeam).trim())[0].logo}  />
          }
           <Text className='font-dinLight text-center h-15  flex-wrap text-sm pt-1 mt-2 mb-2 text-white'>
            {awaiTeam}
          </Text>
        </View>
      
  
</View>  
}

export default Game;