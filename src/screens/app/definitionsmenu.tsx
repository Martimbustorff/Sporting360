import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { View,Image,Text,ScrollView, Dimensions, TouchableOpacity, Linking, SafeAreaView, Platform } from 'react-native';
import Animated, { FadeIn, FadeInUp, interpolateColor, useAnimatedStyle, useSharedValue, withTiming }  from 'react-native-reanimated';
import Header from '../../components/Header';
import Month from '../../components/Calendar/Month';
import Game from '../../components/Calendar/Game';
import firestore from '@react-native-firebase/firestore';
import ical from 'ical.js'
import axios from 'axios'
import { handleGetCalendarIcal } from '../../utils/getMatchShedule';
import { MatchSchedule } from '../../interfaces/MatchSchedule';
import { ClubSites } from '../../constants/ClubSites';
interface GroupedData {
  [yearMonth: string]: Array<{
    adversary: string;
    home: boolean;
    journey: string;
    month: string;
    year: string;
  }>;
}

const DefinitionsMenu = () => {
  const navigation = useNavigation()
  return <SafeAreaView className={` bg-bgauth  flex-1 h-full justify-start items-center`}>
  <Image
        className='flex flex-1  absolute h-full w-full'
        source={require('../../assets/opacebg.png')}  >
      </Image>
      <Animated.View 
            style={[{backgroundColor:'#001B13'}]}
            className='flex flex-1 absolute h-full w-full opacity-80'>
          </Animated.View>
  <Animated.View 
    entering={FadeInUp.delay(100)}
    className="  flex flex-col mt-0 h-full w-full" >
       <View className="mb-1  mt-2 mt-[2]  w-full ">
         <Header title={'DEFINIÇÕES'}></Header>
      </View>
      <ScrollView>
      <Animated.View   entering={FadeIn.delay(600)} className='flex  justify-end flex-col flex-1  gap-4'>
                <TouchableOpacity
                   activeOpacity={0.7}
                   onPress={()=>navigation.navigate('Definitions')}
                   className='pl-6 pr-6  '>
                    <View className='flex flex-row border-b-[0.5px] border-b-white pb-3  gap-2 justify-between items-center'>
                      <View className='flex flex-row  justify-center pb-3 items-center'>
                        <Image resizeMode="contain"  className="h-6 w-4 mr-2 object-contain" source={require('../../assets/icons/userinfo.png')} />
                        <Text  className={`font-dinBold ${Platform.OS === 'ios' ? 'h-6 mt-4' : 'mt-0'} text-white text-sm`} >CONTA S360</Text>
                      </View>
                      <Image  source={require('../../assets/arrow.png')} className="top-1"/>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                   activeOpacity={0.7}
                   onPress={()=>navigation.navigate('GameboxList')}
                   className='pl-6 pr-6  '>
                    <View className='flex flex-row border-b-[0.5px] border-b-white pb-3  gap-2 justify-between items-center'>
                      <View className='flex flex-row  justify-center pb-3 items-center'>
                        <Image  resizeMode="contain"  className="h-6 w-4 mr-2 object-contain" source={require('../../assets/icons/qrcode.png')} />
                        <Text  className={`font-dinBold ${Platform.OS === 'ios' ? 'h-6 mt-4' : 'mt-0'} text-white text-sm`} >GESTÃO GAMEBOX</Text>
                      </View>
                      <Image  source={require('../../assets/arrow.png')} className="top-1"/>
                    </View>
                  </TouchableOpacity>
            </Animated.View>
      </ScrollView>
  </Animated.View>
  </SafeAreaView>
}

export default DefinitionsMenu;