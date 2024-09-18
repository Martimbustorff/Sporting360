import { useNavigation } from '@react-navigation/native';
import React, { useRef, useState } from 'react';
import { View,Image,Text,ScrollView, Dimensions, TouchableOpacity, Linking, Platform, StatusBar } from 'react-native';
import Animated, { FadeInUp, interpolateColor, useAnimatedStyle, useSharedValue, withTiming }  from 'react-native-reanimated';

interface IMonth {
  title: string;
}
const Month = ({title}:IMonth) => {
  return  <View className='relative h-10   w-full justify-end items-center '>
    <Text className='font-dinBold text-lg  mt-2 mb-2 text-white'>
    {title}
    </Text>
    <View className='absolute  bg-white flex w-full h-full  opacity-5'>
    </View>
  
</View>  
}

export default Month;