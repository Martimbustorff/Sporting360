import { useFonts } from "expo-font";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Animated from 'react-native-reanimated';

import {
  Image,
  ImageBackground,
  View,
  Text,
  Animated as AnimatedR,
  TouchableOpacity,
  Button,
  Platform,
  Pressable,
  Dimensions,
  Linking,
  ScrollView,
} from "react-native";
import  {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { BarCodeScanner } from "expo-barcode-scanner";
import firestore from '@react-native-firebase/firestore';
import CryptoJS from "react-native-crypto-js";

import BottomSheet from '@gorhom/bottom-sheet';
import { Urls } from '../../constants/Urls';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useAuthStore } from '../../store/auth.store';
import { showMessage } from "react-native-flash-message";
import Barcode from '@kichiyaki/react-native-barcode-generator';
import { decryptGameBox } from "../../services/decryptGameBox";
import WebView from "react-native-webview";
import { MMKV } from "react-native-mmkv";
import QRCode from 'react-native-qrcode-svg';
import { logbase64 } from "../../constants/logobase64";
import { Background } from "../../components/Home/Background";
import { Gamebox } from "../../interfaces/Gamebox";
import HomeHeader from "../../components/Home/HomeHeader";
import HomeMenuItem from "../../components/Home/HomeMenuItem";
import GameboxCard from "../../components/Home/Gamebox/GameboxCard";
import crashlytics from '@react-native-firebase/crashlytics';
import { defaultGamebox } from "../../utils/returnDefaultGamebox";
import { useGameboxRead } from "../../store/gameboxread.store";
import { appversion } from "../../constants/appversion";
import PrincipalGame from "../../components/Calendar/PrincipalGame";
import { IGame, getNextGame } from "../../api/firebase/games";
import PrincipalGameHome from "../../components/Calendar/PrincipalGameHome";
const Home = () => {
  const navigation = useNavigation()
  const user = useAuthStore((state) => state.user)
  const heigthBootomValue = useSharedValue(120);
  const mtValue = useSharedValue(0);
  const [hasPermission, setHasPermission] = useState(null);
  const [open, setOpen] = useState(false);
  const addGamebox = useGameboxRead((state) => state.add)
  const [nextGame,setNextGame] = useState<IGame>(null)


  const [gameboxes,setGameboxes] = useState<Gamebox[]>([])



  // MARK: GET GAMES
  useEffect(()=>{
    const getGames = async ()=>{
      const nextGameResponse = await getNextGame()
      setNextGame(nextGameResponse)
    }
    getGames()
  },[])
 
  const handleOpenGameboxView = async () => {
   const result = await askForCameraPermission();
    if(result){
      handleOpenGameBox()
      navigation.navigate('Gamebox')  
    }else{
      showMessage({
        message: "Necessário permissões para leitura da gamebox" ,
        type: "warning",
        color:'#D3D3D3',
        style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
        titleStyle:{fontFamily:'DinBold',lineHeight:20},
        backgroundColor:'#121212',
      });
    }
  
  }
  const askForCameraPermission = async ():Promise<boolean> => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === "granted");
      return status === "granted"
  };


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
 
  const handleOpenGameBox = () => {
    if(!open){
      heigthBootomValue.value = withTiming(260, { duration: 600 });
      mtValue.value = withTiming(10, { duration: 600 });
      setOpen(!open)
    }else{
      heigthBootomValue.value = withTiming(135, { duration: 600 });
      mtValue.value = withTiming(0, { duration: 600 });
      setOpen(!open)
    }
  }

  const handleOpenGameBoxWithFill = () => {
    if(!open){
      heigthBootomValue.value = withTiming(500, { duration: 800 });
      mtValue.value = withTiming(10, { duration: 600 });
      setOpen(!open)
    }else{
      heigthBootomValue.value = withTiming(115, { duration: 600 });
      mtValue.value = withTiming(0, { duration: 600 });
      setOpen(!open)
    }
  }

  useEffect(() => {
    const storage = new MMKV()
    storage.set('user.enterInApp', '1')
    heigthBootomValue.value = withTiming(115, { duration: 600 });
    addGamebox({gameboxNumber:""})

  }, []);

  const handleGetGameboxes = async () => {
   try {
    const storage = new MMKV()
    const defaultGameboxInsert = storage.getString('user.defaultGameboxInsert')
    if(appversion < 5.4){
      try {
        await firestore().collection('gamebox').add({
          gameboxNumber:defaultGamebox(user).gameboxNumber.trim(),
          gameboxLine:defaultGamebox(user)?.gameboxLine,
          gameboxName:defaultGamebox(user)?.gameboxName,
          userid:user.uuid,
          order:gameboxes.length + 1,
          gameboxPort:defaultGamebox(user)?.gameboxPort,
          gameboxSeat:defaultGamebox(user)?.gameboxSeat,
          gameboxSector:defaultGamebox(user)?.gameboxSector
        })
      } catch (error) {
        console.log(error)
      }
      storage.set('user.defaultGameboxInsert', '1')
    }
     const gameboxListCollections = await firestore().collection('gamebox').where('userid','==',user.uuid).get();
     const gameboxfirebase = []
     for (const iterator of gameboxListCollections.docs) {
       const data = iterator.data() as Gamebox
       data.id = iterator.id
       gameboxfirebase.push(data)
     }
     console.log(gameboxfirebase)
     console.log(user)
     setGameboxes(gameboxfirebase)
   } catch (error) {
        crashlytics().recordError(error);
        if(user){
          showMessage({
            message: "Não foi possível obter Gamebox! Por favor tente mais tarde.",
            type: "warning",
            color:'#D3D3D3',
            style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
            titleStyle:{fontFamily:'DinBold',lineHeight:20},
            backgroundColor:'#121212',
          });
        }
       
   }
 };


   
 useFocusEffect(
  React.useCallback(() => {
    handleGetGameboxes()
  }, [user])
);
 
  const AnimatedTouchable = AnimatedR.createAnimatedComponent(TouchableOpacity);
  const scrollX = new AnimatedR.Value(0);
  let position = AnimatedR.divide(scrollX,328);

  return (
    <View className="bg-background  h-full w-full">
    {/* Background Component */}
    <Background />

    <Animated.View entering={FadeIn.delay(1200)} className='flex flex-col flex-[0.4] justify-between p-8 pt-16 '>
      {/* Header Component */}
      <HomeHeader navigation={navigation} user={user} />
    </Animated.View>
    {nextGame &&
      <View className="flex flex-[0.8]">
          <PrincipalGameHome
            id={Number(nextGame?.api)}
            key={nextGame?.api}
            timestamp={nextGame?.timestamp}
            awayteam={nextGame?.teamaway.name}
            competation={nextGame?.competition}
            hometeam={nextGame?.teamhome.name}
            isStart={Number(nextGame?.elapsedTime) > 0}
            jorney={nextGame?.journey}
            resultaway={nextGame?.scoreaway}
            resultHome={nextGame?.scorehome}
            uriAwayLogo={nextGame?.teamaway.logo}
            elapseTime='0'
            uriLogo={nextGame?.teamhome.logo}
          />
      </View>
      }
    <Animated.View entering={FadeIn.delay(1200)} className='flex justify-end flex-col flex-[0.9]  '>
      {/* Menu Items */}
      {Urls.map((item, index) => {
        return <HomeMenuItem
          Urls={Urls}
          index={index}
          key={item.url} item={item} navigation={navigation} />;
      })}
      <View  className={` mb-16 mt-0 flex-col justify-center    w-full rounded-t-[48px] p-8 `}></View>
      {/* Gamebox Section */}
      {user && gameboxes.length > 0 ? (
        <Animated.View style={bootomBackgroundStyle} className={`bg-white absolute flex-row    w-[100%] rounded-t-[48px] pr-8 pl-8 pb-8 pt-4 `}>
          {/* Gamebox Cards */}
          <View className={`w-full ${open ? 'flex-col' : 'flex-col'} justify-between`} onPress={()=>handleOpenGameBoxWithFill()} >
            <View className="flex flex-row w-full justify-between items-center">
              <Text className='font-dinBold text-titleauth text-xl mt-[4] mb-2'>GAMEBOX DIGITAL</Text>
              <TouchableOpacity onPress={()=>handleOpenGameBoxWithFill()}>
                <Text className="text-black  text-center text-sm  mb-4 font-dinRegular ">
                  {open ? <Image source={require('../../assets/Chevron_Up.png')}></Image>
                    : <Image source={require('../../assets/Chevron_down.png')}></Image> 
                  }
                </Text>
              </TouchableOpacity>
            </View> 
            {open ? 
            <>
            <ScrollView
                onScroll={AnimatedR.event([
                  { nativeEvent: { contentOffset: { x: scrollX } } },
                ])}
                showsHorizontalScrollIndicator={false}
                horizontal= {true}
                decelerationRate={0}
                snapToInterval={328} // your element width
              >
                {gameboxes.sort((a, b) => a.order - b.order).map((gamebox) => {
                  return <GameboxCard navigation={navigation} user={user} key={gamebox.id} gamebox={gamebox} />;
                })}
              </ScrollView>
              <View className="flex justify-center  w-full flex-row">
                {gameboxes.map((item,i)=>{
                  let backgroundColor = position.interpolate({
                    inputRange: [i - 1, i, i + 1],
                    outputRange: ['#0000003c', '#003625','#0000003c'],
                    extrapolate: 'clamp',
                  });
                  return(
                    <AnimatedR.View
                      key={i}
                      style={{
                        height: 10,
                        width: 10,
                        backgroundColor,
                        margin: 5,
                        borderRadius: 5,
                      }}
                    />
                  )
                })}
              </View>
            </>
            :
            <TouchableOpacity >
              <Text className="text-black   text-sm  mb-4 font-dinRegular ">
                Aumenta o cartão para veres a gamebox 
              </Text>
            </TouchableOpacity>
            }
          </View> 
        </Animated.View>
      ) : (
        <Animated.View style={bootomBackgroundStyle} className={`bg-white absolute flex-col     w-[100%] rounded-t-[48px] pt-4 pl-8 pr-8 pb-8 `}>
          {/* Gamebox Management Section */}
          <Pressable onPress={() => handleOpenGameBox()}>
            <View className="flex flex-row w-full justify-between items-center">
              <Text className='font-dinBold text-titleauth text-xl  '>GAMEBOX DIGITAL</Text>
              <TouchableOpacity onPress={() => handleOpenGameBox()}>
                <Text className="text-black  text-center text-sm  mb-4 font-dinRegular ">
                  {open ? <Image source={require('../../assets/Chevron_Up.png')} /> : <Image source={require('../../assets/Chevron_down.png')} />}
                </Text>
              </TouchableOpacity>
            </View>
            {/* Gamebox Management Content */}
            <>
              {open && (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    handleOpenGameboxView();
                  }}
                  className='bg-titleauth w-full h-14 justify-center items-center rounded-full mb-4 mt-4'
                >
                  <Text className={`text-white font-dinBold ${Platform.OS === 'ios' ? 'mt-3' : 'mt-0'} text-lg`}>DIGITALIZAR</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity  className="flex-row " onPress={() => navigation.navigate('GameboxMangement')}>
                <Text className="text-black  text-sm  mb-4 font-dinRegular ">
                  Digitaliza o código de barras da tua Gamebox {'\n'} ou <Text className="text-titleauth  leading-5   text-sm font-dinBold">{''} insere manualmente</Text> o número.
                </Text>
              </TouchableOpacity>
            </>
          </Pressable>
        </Animated.View>
      )}
    </Animated.View>
  </View>
  );
};

export default Home;

