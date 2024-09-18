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

const CubSites = () => {
  const navigation = useNavigation()

 
  return <SafeAreaView className={`bg-bgauth  flex-1 h-full justify-start items-center`}>
  <Animated.View 
    entering={FadeInUp.delay(100)}
    className="bg-bgauth flex flex-col mt-0 h-full w-full" >
       <View className="  mt-2 mt-[2] mb-[-15] w-full ">
         <Header title={'SITES DO CLUBE'}></Header>
      </View>
      <Text className=' pl-4 pr-4 font-dinLight text-base mb-6 leading-1 text-white'>Aqui podes encontrar ligações directas para os sites oficiais do clube. </Text>
      <ScrollView>
      <Animated.View   entering={FadeIn.delay(600)} className='flex justify-end flex-col flex-1  gap-4'>
            {ClubSites.map((item,index)=>{
              return (
                  <TouchableOpacity
                   activeOpacity={0.7}
                   onPress={async ()=>{
                    if(Platform.OS === 'ios'){
                      await Linking.openURL(item.url);
                    }else{
                      navigation.navigate('Browser',{
                        index:index
                       })
                    }
                   }}
                   key={item.url} className='pl-6 pr-6  '>
                    <View className='flex flex-row border-b border-b-white pb-3  gap-2 justify-between items-center'>
                      <View className='flex flex-row  justify-center pb-3 items-center'>
                        <Image resizeMode="contain"  className="h-8 w-6 mr-2 object-contain" source={item.image} />
                        <Text  className={`font-dinBold ${Platform.OS === 'ios' ? 'h-6 mt-4' : 'mt-0'} text-white text-sm`}>{item.title}</Text>
                      </View>
                      <Image  source={require('../../assets/arrow.png')} className="top-1"/>
                    </View>
                  </TouchableOpacity>
              )
            })}
            </Animated.View>
      </ScrollView>
  </Animated.View>
  </SafeAreaView>
}

export default CubSites;