import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useRef, useState } from 'react';
import { View,Image,Text,ScrollView, Dimensions, TouchableOpacity, Linking, SafeAreaView } from 'react-native';
import Animated, { FadeInUp, interpolateColor, useAnimatedStyle, useSharedValue, withTiming }  from 'react-native-reanimated';
import { WebView } from 'react-native-webview';

import Header from '../../components/Header';
import { ClubSites } from '../../constants/ClubSites';

const Browser = () => {
  const navigation = useNavigation()
  const routes = useRoute()
  const index = Number(routes.params.index)
  return <SafeAreaView className={`bg-primary  flex-1 h-full justify-start items-center`}>
  <Animated.View 
    style={{backgroundColor:'#003625'}}
    entering={FadeInUp.delay(100)}
    className="bg-background flex flex-col mt-0 h-full w-full" >
       <View className="  mt-2 mt-[2] mb-[-15] w-full ">
         <Header title={ClubSites[index].title}></Header>
      </View>
    <WebView
      className='h-full flex-1 w-full'
      source={{ uri:  ClubSites[index].url }}
    />
  </Animated.View>
  </SafeAreaView>
}

export default Browser;