import { useFonts } from "expo-font";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Image,
  ImageBackground,
  View,
  Text,
  TouchableOpacity,
  Button,
  Platform,
  Pressable,
  Dimensions,
} from "react-native";
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BarCodeScanner } from "expo-barcode-scanner";
import firestore from '@react-native-firebase/firestore';

import BottomSheet from '@gorhom/bottom-sheet';
import { Urls } from '../../constants/Urls';
import { useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/auth.store';
import { showMessage } from "react-native-flash-message";
import Barcode from '@kichiyaki/react-native-barcode-generator';
import { decryptGameBox } from "../../services/decryptGameBox";
import { MMKV } from "react-native-mmkv";

const Index = () => {
  const navigation = useNavigation()
  
  const user = useAuthStore((state) => state.user)
  const login = useAuthStore((state) => state.login)
  const opacityBackgroundValue = useSharedValue(1);

  const opacityBackgroundCircleValue = useSharedValue(0);
  const imageBackgroundCirceValue = useSharedValue(10);

  const heigthBootomValue = useSharedValue(80);
  const mtValue = useSharedValue(0);

  const bgGreenValue = useSharedValue(0.1);

  const [hasPermission, setHasPermission] = useState(null);
  const [scanned, setScanned] = useState(false);
  const [open, setOpen] = useState(false);

  const [text, setText] = useState("Not yet scanned");

  

  // What happens when we scan the bar code
  

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

  const bootomBackgroundStyle = useAnimatedStyle(() => {
    return {
      height: heigthBootomValue.value,
    };
  });

  const mtBackgroundStyle = useAnimatedStyle(() => {
    return {
      marginTop: mtValue.value,
    };
  });

  const bgGreenStyle = useAnimatedStyle(() => {
    return {
      opacity: bgGreenValue.value,
    };
  });
 
  const handleOpenGameBox = () => {
    if(!open){
      heigthBootomValue.value = withTiming(260, { duration: 600 });
      mtValue.value = withTiming(10, { duration: 600 });
      setOpen(!open)
    }else{
      heigthBootomValue.value = withTiming(125, { duration: 600 });
      mtValue.value = withTiming(0, { duration: 600 });
      setOpen(!open)
    }
  }

  const handleOpenGameBoxWithFill = () => {
    if(!open){
      heigthBootomValue.value = withTiming(180, { duration: 600 });
      mtValue.value = withTiming(10, { duration: 600 });
      setOpen(!open)
    }else{
      heigthBootomValue.value = withTiming(125, { duration: 600 });
      mtValue.value = withTiming(0, { duration: 600 });
      setOpen(!open)
    }
  }

  useEffect(() => {

    imageBackgroundCirceValue.value = withTiming(0, { duration: 1100 });
    opacityBackgroundCircleValue.value = withTiming(1, { duration: 1200 });
    bgGreenValue.value = withTiming(0.6, { duration: 1100 });
    heigthBootomValue.value = withTiming(125, { duration: 2300 });
  }, []);

  // Check permissions and return the screens
 
  const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
  return (
    <View className="bg-background h-full w-full">
          <Animated.View
            style={imageBackgroundStyle}
            className="flex flex-1 absolute h-full w-full bg-bgauth"
          ></Animated.View>
          <Animated.Image
            style={imageBackgroundCircleStyle}
            resizeMode={'cover'}
            className='flex flex-1 top-[-9] absolute h-full w-full'
            source={require('../../assets/welcome.png')}  >
          </Animated.Image>
          <Animated.View 
            style={[bgGreenStyle]}
            className='absolute h-full w-full'>
          </Animated.View>
        
          <View className="flex-[1] p-4  justify-end pb-20 flex-col items-center">
              <TouchableOpacity 
                activeOpacity={0.7}
                onPress={()=>navigation.navigate('Home')}
                className='bg-white w-80 h-14 justify-center items-center rounded-full top-4'
              >
               <Text className={`text-titleauth font-dinBold ${Platform.OS === 'ios' ? 'mt-3' : 'mt-0'} text-lg`}>ENTRAR</Text>
              </TouchableOpacity>
           
          </View>
    </View>
  );
};

export default Index;
