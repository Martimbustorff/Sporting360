import React, { useState } from "react"
import { Image, Platform, SafeAreaView, TouchableOpacity, View,Text, ScrollView } from "react-native";
import Animated , { FadeInUp, runOnJS, useAnimatedGestureHandler, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import Header from "../../components/Header";
import { useNavigation } from "@react-navigation/native";
import { Gesture, PanGestureHandler } from "react-native-gesture-handler";


const VISIBLE_AREA_WIDTH = 200;
const VISIBLE_AREA_HEIGHT = 100;

const BOX_BORDER_WIDTH = 5;
const BOX_WIDTH = 150 + BOX_BORDER_WIDTH * 1.9; //add border width
const BOX_HEIGHT = 50 + BOX_BORDER_WIDTH * 1.9; //add border width
const INITIAL_SCALE = 1;
const NEW_SCALE = 0.5;

const clamp = (value, min, max) => {
  'worklet';
  return Math.min(Math.max(min, value), max);
};

export const Stadium = () => {
  const navigation = useNavigation()
  const scaleValue = useSharedValue(1);
  const translationX = useSharedValue(1);
  const translationY = useSharedValue(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isZoomed, setIsZoomed] = useState(false);
  const [max, setMax] = useState({ x: 0, y: 0 });
  const [min, setMin] = useState({ x: 0, y: 0 });
  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translationX.value },
        { translateY: translationY.value },
        { scale: scaleValue.value },
      ],
      
    };
  });
  
  const offset = useSharedValue(0);

  const getEdges = () => {
    'worklet';
    let pointX =
      (BOX_WIDTH * scaleValue.value - VISIBLE_AREA_WIDTH) * -1;
    const pointY =
      (BOX_HEIGHT * scaleValue.value - VISIBLE_AREA_HEIGHT) * -1;

    if (scaleValue.value < 1) {
      pointX -= BOX_WIDTH * scaleValue.value /1.92;
      console.log(-pointX);
    }

    runOnJS(setMin)({
      x: Math.min(pointX, 0),
      y: Math.min(pointY, 0),
    })
    runOnJS(setMax)({
      x:  Math.max(0, pointX),
      y: Math.max(0, pointY)
    })
      
    return {
      x: {
        min: Math.min(pointX, 0),
        max: Math.max(0, pointX),
      },
      y: {
        min: Math.min(pointY, 0),
        max: Math.max(0, pointY),
      },
    };
  };
  const gestureHandler = useAnimatedGestureHandler({
    onStart: (_, ctx) => {
      ctx.startX = translationX.value;
      ctx.startY = translationY.value;
    },
    onActive: (event, ctx) => {
      'worklet';
      translationX.value = ctx.startX + event.translationX;
      translationY.value = ctx.startY + event.translationY;
      // update state to view values on the screen as they change
      runOnJS(setPosition)({ x: translationX.value, y: translationY.value });
    },
    onEnd: () => {
      'worklet';
      const edges = getEdges();
      const boundedX = clamp(
        translationX.value,
        edges.x.min,
        edges.x.max,
      );
      const boundedY = clamp(
        translationY.value,
        edges.y.min,
        edges.y.max
      );

      // create "bounce-y" effect when moving the box back inside the bounds
      translationX.value = withTiming(boundedX);
      translationY.value = withTiming(boundedY);

      // update state to view values on the screen as they change
      runOnJS(setPosition)({ x: boundedX, y: boundedY });
    },
  });
  return (
    <SafeAreaView className={`bg-bgauth  flex-1 h-full justify-start items-center pb-16`}>
       <Image
        className='flex flex-1  absolute h-full w-full'
        source={require('../../assets/opacebg.png')}  >
       </Image>
         <Animated.View 
            style={[{backgroundColor:'#001B13'}]}
            className='flex  absolute h-full w-full opacity-80'>
          </Animated.View>
          <View className=" mt-2 w-full ">
              <View
            style={{height:Platform.OS === "android" ? 110 : 40}}
            className={`w-full ${Platform.OS == 'ios' ? 'h-10 mb-6' : 'h-10'} flex-row  justify-between items-center`}>
            <TouchableOpacity 
            style={{paddingTop:Platform.OS === "android" ? 20 : 0}}
            className={`w-12 h-12 justify-center items-center`} onPress={()=>
              navigation.goBack()
             }>
            <Image  className='h-auto' resizeMode='contain' source={require('../../assets/arrowLeft.png')}></Image>
            </TouchableOpacity>
            <Text className='font-dinBold h-6 mt-2 text-lg text-titleauth'>
              ESTÁDIO
            </Text>
            <TouchableOpacity 
              style={{paddingTop:Platform.OS === "android" ? 10 : 0}}    
              className={`w-12 h-12 justify-center items-center`} onPress={()=>{
                  if(isZoomed){
                   setIsZoomed(false)
                   scaleValue.value = withTiming(1, { duration: 300 })
                   translationX.value = withTiming(1, { duration: 300 })
                   translationY.value = withTiming(1, { duration: 300 })

                   return;
                  }
                  setIsZoomed(true)
                  scaleValue.value = withTiming(1.6, { duration: 300 })
               }
              }>
              <Image  className='h-auto' resizeMode='contain' source={isZoomed ? require('../../assets/icons/Shrink.png') : require('../../assets/icons/Expand.png')}></Image>
            </TouchableOpacity>
            </View>
         </View>
            <View className="flex flex-1 justify-center  items-center">
            <PanGestureHandler
          onGestureEvent={gestureHandler}
          enabled={isZoomed}>
                <Animated.Image className='h-96 w-96 object-contain' resizeMode={'contain'} style={animatedStyle} source={require('../../assets/stadiummap.png')} ></Animated.Image>
                </PanGestureHandler>
            </View>
            <View className="flex-col w-full h-40 p-4">
                <View className={`flex flex-row ${Platform.OS === 'android' ? 'h-5' : 'h-3'}  mb-12 gap-4 w-full justify-start items-center`}>
                  <Image className="" source={require('../../assets/icons/Museum.png')} ></Image>
                  <Text className={`font-bold text-center  h-full text-sm text-white font-dinBold`}>MUSEU SPORTING</Text>
                </View>
                <View className={`flex flex-row ${Platform.OS === 'android' ? 'h-5' : 'h-3'}  mb-12 gap-4 w-full justify-start items-center`}>
                  <Image className="h-5 w-5" source={require('../../assets/store.png')} ></Image>
                  <Text className="font-bold h-full text-sm text-white font-dinBold">LOJA VERDE</Text>
                </View>
                <View className={`flex flex-row ${Platform.OS === 'android' ? 'h-5' : 'h-3'}  mb-12 gap-4 w-full justify-start items-center`}>
                  <Image className="h-5 w-5" resizeMode="contain" source={require('../../assets/tickets.png')} ></Image>
                  <Text className="font-bold h-full text-sm text-white font-dinBold">BILHETEIRA</Text>
                </View>
            </View>
    </SafeAreaView>
  )
}