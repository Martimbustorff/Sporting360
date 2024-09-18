import React, { useEffect, useRef, useState } from "react";
import {
  Text,
  TextInput,
  SafeAreaView,
  TouchableOpacity,
  View,
  Image,
  ActivityIndicator,
  Platform,
  ScrollView,
  Alert,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import auth from '@react-native-firebase/auth';
import firestore, { firebase } from '@react-native-firebase/firestore';
import { showMessage, hideMessage } from "react-native-flash-message";
import Animated, { FadeIn } from "react-native-reanimated";
import CryptoJS from "react-native-crypto-js";
import DateTimePicker from '@react-native-community/datetimepicker';
import { useAuthStore } from "../../../store/auth.store";
import { decryptGameBox } from "../../../services/decryptGameBox";
import Input from "../../../components/Input";
import Header from "../../../components/Header";
import { Gamebox } from "../../../interfaces/Gamebox";
import { useGameboxRead } from "../../../store/gameboxread.store";
import DraggableFlatList, { NestableScrollContainer, NestableDraggableFlatList, ScaleDecorator, ShadowDecorator, OpacityDecorator } from "react-native-draggable-flatlist"
import { defaultGamebox } from "../../../utils/returnDefaultGamebox";
const GameboxList = () => {
  const user = useAuthStore((state) => state.user)
  const addGamebox = useGameboxRead((state) => state.add)

  const [loading,setLoading] = useState(false)
  const [gameboxes,setGameboxes] = useState<Gamebox[]>([])

  const navigation = useNavigation();

  const handleGetGameboxes = async () => {
     setLoading(true)
    try {
      const gameboxListCollections = await firestore().collection('gamebox').where('userid','==',user.uuid).get();
      const gameboxfirebase = []
      for (const iterator of gameboxListCollections.docs.sort(x=>x.data.order)) {
        const data = iterator.data() as Gamebox
        data.id = iterator.id
        gameboxfirebase.push(data)
      }
      setGameboxes(gameboxfirebase.sort((a, b) => a.order - b.order))
      setLoading(false)
    } catch (error) {
      setLoading(false)
      showMessage({
        message: "Não foi possível obter Gamebox! Por favor tente mais tarde.",
        type: "warning",
        color:'#D3D3D3',
        style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
        titleStyle:{fontFamily:'DinBold',lineHeight:20},
        backgroundColor:'#121212',
      });
      setLoading(false)
    }
  };

  useEffect(()=>{
    addGamebox({gameboxNumber:""})
  },[])
  useFocusEffect(
    React.useCallback(() => {
      handleGetGameboxes()
      
    }, [])
  );

  return (
    <SafeAreaView className={`bg-bgauth  flex-1 h-full justify-start items-center`}>
       <Image
        className='flex flex-1  absolute h-full w-full'
        source={require('../../../assets/opacebg.png')}  >
      </Image>
      <Animated.View 
            style={[{backgroundColor:'#001B13'}]}
            className='flex flex-1 absolute h-full w-full opacity-80'>
          </Animated.View>
          <View className=" mt-2 mt-[5] mb-[-15] w-full ">
          <Header  title="GESTÃO GAMEBOX"></Header>
      </View>
      {gameboxes.length >= 6 &&
        <View className='w-full bg-white_20 h-8  justify-center items-center'>
        <Text className={`text-white font-dinBold ${Platform.OS === 'ios' && 'pt-2'}  text-sm `}>
          Já atingiu o máximo de 6 Gamebox
        </Text>
       </View>
      }
      <View className={`mt-4  pl-6 pr-6   flex flex-1 w-full`}>
        <Animated.View  entering={FadeIn.delay(100)} className="flex flex-[0.9] w-full">
          <DraggableFlatList
          data={gameboxes.sort(x=>x.order)}
          renderItem={({item,drag,isActive})=> {
            return (
              <OpacityDecorator>
                  <TouchableOpacity
                  onLongPress={drag}
                  disabled={isActive}
                  onPress={()=>navigation.navigate('GameboxMangement',{
                    id:item.id
                  })}
                  activeOpacity={0.7} className="flex w-full h-10 mb-4 justify-between flex-row">
                  <View className="flex flex-row items-center justify-center ">
                   {!item.default &&  <Image className="h-7 mt-[-15] mr-2 w-7" source={require('../../../assets/icons/Menu.png')} /> }
                    <Text className={`text-base ${Platform.OS === 'android' ? "h-7 mt-[-15]": "h-7"}  font-dinBold text-white`}>{item.gameboxName}</Text>
                  </View>
                  <Image  source={require('../../../assets/arrow.png')} className="top-1"/>
                </TouchableOpacity>
             </OpacityDecorator>
            )
          }}
          keyExtractor={(item)=>item.id}
          onDragEnd={async ({ data }) => {
            setGameboxes(data)
            const gameboxCollection = firestore().collection('gamebox');
            let index = 1
            data.forEach(async (item,index)=>{
              console.log(item.id)
              await gameboxCollection.doc(item.id).update({
                order:index +1 ,
              })
            })
          
          }}
        />
        </Animated.View>
      {gameboxes.length < 6 &&   <TouchableOpacity 
          onPress={()=>{
            addGamebox({gameboxNumber:""})
            navigation.navigate('GameboxMangement')
          }}
            activeOpacity={0.7}
            className='bg-white rounded-full w-14 right-6 absolute  bottom-20  h-14 justify-center   items-center '
          >
             <Image   className=" h-5 w-5" resizeMode="contain"  source={require('../../../assets/icons/arrowplus.png')} />

        </TouchableOpacity> }
      </View>
    </SafeAreaView>
  );
};

export default GameboxList;
