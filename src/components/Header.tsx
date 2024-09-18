import { useNavigation } from '@react-navigation/native';
import React, { useRef, useState } from 'react';
import { View,Image,Text,ScrollView, Dimensions, TouchableOpacity, Linking, Platform, StatusBar } from 'react-native';
import Animated, { FadeInUp, interpolateColor, useAnimatedStyle, useSharedValue, withTiming }  from 'react-native-reanimated';

interface IHeader {
  title: string;
  hideBackButton: boolean;
}
const Header = ({title,hideBackButton = false}:IHeader) => {
  const navigation = useNavigation()

  return  <View
  style={{height:Platform.OS === "android" ? 110 : 40}}
  className={`w-full ${Platform.OS == 'ios' ? 'h-10 mb-6' : 'h-10'} flex-row  justify-between items-center`}>
  <TouchableOpacity 
   style={{paddingTop:Platform.OS === "android" ? 20 : 0}}
  className={`w-12 h-12 justify-center items-center`} onPress={()=>navigation.goBack()}>
   {!hideBackButton && <Image  className='h-auto' resizeMode='contain' source={require('../assets/arrowLeft.png')}></Image>}
  </TouchableOpacity>
  <Text className='font-dinBold h-6 mt-2 text-lg text-titleauth'>
    {title}
  </Text>
  <TouchableOpacity className='w-12 h-12 justify-center items-start' >
  </TouchableOpacity>
</View>  
}

export default Header;