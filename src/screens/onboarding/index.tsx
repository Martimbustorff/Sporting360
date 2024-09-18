import React, { useRef, useState } from 'react';
import { View,Image,Text,ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import Animated, { FadeInUp, interpolateColor, useAnimatedStyle, useSharedValue, withTiming }  from 'react-native-reanimated';
import { useNavigation } from '@react-navigation/native';
import { interpolate } from 'react-native-reanimated';

const Intro = () => {
  const scrollViewRef = useRef<ScrollView>(null)

  const navigation = useNavigation()
  const onboardingData = [
     {
      Image:require('../../assets/onboarding/onboarding1.png'),
      Title:'Acede aos serviços do clube',
      SubTitle:'  Explora o mundo verde e branco com a nossa aplicação',
    },
    {
      Image:require('../../assets/onboarding/onboarding2.png'),
      Title:'Faz upload da tua Gamebox',
      SubTitle:'  Leva o Sporting contigo para onde quer que vás',
    }
  ]

  const progress = useSharedValue(0);
  const [actualIndex,setActualIndex] = useState(0)  

  const handleScroll = (event) => {
    const { contentOffset, layoutMeasurement } = event.nativeEvent;
    const screenWidth = layoutMeasurement.width;
    const currentOffset = contentOffset.x;

    const newIndex = Math.floor(currentOffset / screenWidth);
    progress.value = withTiming(newIndex, { duration: 200 });
    setActualIndex(newIndex)
  };

  return <View className="bg-background h-full w-full" >
        
        <ScrollView 
            horizontal  
            ref={scrollViewRef}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            pagingEnabled 
           contentContainerStyle={{flexGrow: 1}}>
            {onboardingData.map((data,index) =>{
              return (
                <View key={index} style={{ flex: 1,width:Dimensions.get('screen').width }}>
                  <View 
                  className='flex-[0.8]'
                >
                    <Image 
                    className='flex-[0.8] absolute'
                    source={data.Image}
                  />
                  </View>
                  <View 
                    className='flex flex-col  mt-[-40px] 
                              flex-[0.2]
                              justify-start p-6 items-center'>
                        
                        <Animated.View  
                        
                        className=' flex-[0.6] gap-4 flex-col justify-start items-center'>
                              <Animated.Text 
                                entering={FadeInUp.delay(100)}
                                className='font-poppinsSemiBold 
                                          text-white text-xl'
                            >
                                {data.Title}
                            </Animated.Text>
                            <Animated.Text  
                                entering={FadeInUp.delay(200)}
                                className='font-dinLight 
                                          text-white text-sm text-center'
                              >
                            {data.SubTitle}
                            </Animated.Text >
                        </Animated.View >

                    
                    <View>

                    </View>
                  </View>
                  </View>
              )
            })}
        </ScrollView>

        <View className='flex flex-row justify-center w-full p-4 gap-3'>
          {onboardingData.map((data,i)=> {
            const animatedStyle = useAnimatedStyle(() => {
              return {
                width: interpolate(
                   progress.value,
                  [i-1 , i , i+1],
                   [15,25,15]
                ),
                backgroundColor: interpolateColor(
                  progress.value,
                  [i-1 , i , i+1],
                  ['#fff', '#04764E','#fff']
                ),
              };
              });
              return (
                <Animated.View key={i}  style={[{height:15},animatedStyle]}  className='w-5 h-5 rounded-full'></Animated.View>
              )
          })}
        </View>
     
        <View className='flex-[0.2] p-4 gap-3 flex flex-row'>
                  <TouchableOpacity 
                    onPress={()=>navigation.navigate('AuthHome')}
                    activeOpacity={0.7}
                    className='bg-secondary flex-[0.5] h-14 justify-center items-center rounded-full'
                  >
                    <Text className='text-white font-dinMedium text-md'>SALTAR</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    activeOpacity={0.7}
                    onPress={()=>{
                      if((actualIndex + 1) === onboardingData.length){
                        navigation.navigate('AuthHome')
                        return;
                      }
                      scrollViewRef.current?.scrollTo({
                       x: (actualIndex + 1) *  Dimensions.get('screen').width ,
                     })}}
                    className='bg-primary flex-[0.5] h-14 justify-center items-center rounded-full'
                  >
                    <Text className='text-white font-dinMedium text-md'>
                      { (actualIndex + 1) === onboardingData.length ? 'FINALIZAR' : 'SEGUINTE'}
                    </Text>
                  </TouchableOpacity>
              </View>
              {/* <Button title='Login' onPress={() => navigation.navigate('Register')}/> */}
  </View>
}

export default Intro;