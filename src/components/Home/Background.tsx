import React ,{ useEffect } from "react";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"

export const Background = () => {
  const opacityBackgroundCircleValue = useSharedValue(0);
  const imageBackgroundCirceValue = useSharedValue(10);
  const bgGreenValue = useSharedValue(0.1);

  useEffect(() => {
    imageBackgroundCirceValue.value = withTiming(0, { duration: 1100 });
    opacityBackgroundCircleValue.value = withTiming(1, { duration: 1200 });
    bgGreenValue.value = withTiming(0.6, { duration: 1100 });
  }, []);

  const bgGreenStyle = useAnimatedStyle(() => {
    return {
      opacity: bgGreenValue.value,
    };
  });

  const imageBackgroundCircleStyle = useAnimatedStyle(() => {
    return {
      opacity: opacityBackgroundCircleValue.value,
    };
  });
  const imageBackgroundStyle = useAnimatedStyle(() => {
    return {
      left: imageBackgroundCirceValue.value,
    };
  });

  return (
    <>
       <Animated.Image
        style={imageBackgroundStyle}
        className="flex flex-1 top-20 absolute h-full w-full"
        source={require("../../assets/bghome.png")}
      ></Animated.Image>
      <Animated.Image
        style={imageBackgroundCircleStyle}
        className='flex flex-1 top-0 absolute h-96 w-full'
        source={require('../../assets/Circle2.png')}  >
      </Animated.Image>
      <Animated.View 
            style={[{backgroundColor:'#003625'},bgGreenStyle]}
            className=' absolute h-full w-full'>
      </Animated.View>
    </>
  )
}