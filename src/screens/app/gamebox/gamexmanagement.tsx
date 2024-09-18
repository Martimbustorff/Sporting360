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
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
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
import { defaultGamebox } from "../../../utils/returnDefaultGamebox";

const GameboxMangement = () => {
  const user = useAuthStore((state) => state.user)
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)
  const addGamebox = useGameboxRead((state) => state.add)
  const gameboxReaded = useGameboxRead((state) => state.gamebox)
  const [gameboxNumber,setGameboxNumber] = useState("")
  const [gameboxLine,setGameboxLine] = useState("")
  const [gameboxPort,setGameboxPort] = useState("")
  const [gameboxName,setGameboxName] = useState("")
  const [gameboxSeat,setGameboxSeat] = useState("")
  const [gamebox,setGamebox] = useState<Gamebox>(null)
 
  const [gameboxSector,setGameboxSector] = useState("")

  const [loading,setLoading] = useState(true)
 
  const navigation = useNavigation();
  const route = useRoute();

  //TODO:
  // BUSCAR SE TIVER ID OS DADOS DA GAMEBOX PARA EDITAR
  
  const handlePress = async () => {
     const gameboxCollection = firestore().collection('gamebox');
     if(!gameboxNumber.trim()){
      showMessage({
          message: "Número Gamebox Obrigatório",
          type: "success",
          color:'#fff',
          style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
          titleStyle:{fontFamily:'DinBold',lineHeight:20},
          backgroundColor:'#003625',
       });
       return;
     }
     setLoading(true)

    try {
      const passphrase = 'SCP3#$)=:JI)!F5860_'+user.uuid;
      const numberEncprypt = CryptoJS.AES.encrypt(String(`${user.uuid}_${gameboxNumber.trim()}`), passphrase).toString();

      if(route.params?.id){
        await gameboxCollection.doc(route.params?.id).update({
          gameboxNumber:numberEncprypt,
          gameboxLine,
          gameboxName,
          userid:user.uuid,
          order:gamebox.order,
          gameboxPort,
          gameboxSeat,
          gameboxSector
        })
      }else{
        await firestore().collection('gamebox').add({
          gameboxNumber:numberEncprypt,
          gameboxLine,
          gameboxName,
          userid:user.uuid,
          order:gameboxes.length + 1,
          gameboxPort,
          gameboxSeat,
          gameboxSector
        })
      }
     
      setLoading(false)
      showMessage({
        message: "Alterações salvas com sucesso!",
        type: "success",
        color:'#fff',
        style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
        titleStyle:{fontFamily:'DinBold',lineHeight:20},
        backgroundColor:'#003625',
      });
      addGamebox({gameboxNumber:""})
      navigation.navigate("GameboxList")
    } catch (error) {
      console.log(error.message)
      setLoading(false)
      showMessage({
        message: "Para guardar, por favor preenche todos os campos!",
        type: "warning",
        color:'#D3D3D3',
        style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
        titleStyle:{fontFamily:'DinBold',lineHeight:20},
        backgroundColor:'#121212',
      });
    }
  };

  const handleGetGameboxById = async (id:String) => {
    const doc = firestore().collection('gamebox').doc(route.params?.id);
    if(doc){
      const gameboxfirebase =(await doc.get()).data() as Gamebox
      setGameboxNumber(decryptGameBox(gameboxfirebase.gameboxNumber,user.uuid))
      setGameboxLine(gameboxfirebase.gameboxLine)
      setGameboxPort(gameboxfirebase.gameboxPort)
      setGameboxName(gameboxfirebase.gameboxName)
      setGameboxSeat(gameboxfirebase.gameboxSeat)
      setGamebox(gameboxfirebase)
      setGameboxSector(gameboxfirebase.gameboxSector)
    }
   
  }
  const handleDelete = async () => {

    try {
      firestore()
      .collection('gamebox')
      .doc(route.params?.id)
      .delete()
      
      showMessage({
        message: "Gamebox eliminada com sucesso!",
        type: "success",
        color:'#fff',
        style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
        titleStyle:{fontFamily:'DinBold',lineHeight:20},
        backgroundColor:'#003625',
      });
      navigation.navigate("GameboxList")
    } catch (error) {
      console.log("ERRO")
      showMessage({
        message: "Não foi possivel eliminar a Gamebox, Por Favor tente novamente mais tarde",
        type: "success",
        color:'#fff',
        style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
        titleStyle:{fontFamily:'DinBold',lineHeight:20},
        backgroundColor:'#003625',
      });
    }
  
  }
  useFocusEffect(
    React.useCallback(() => {
      if(gameboxReaded.gameboxNumber){
        setLoading(true)
        setTimeout(() => {
          setLoading(false)
        }, 1000);
        setGameboxNumber(gameboxReaded.gameboxNumber)
      }
    }, [])
  );
  useEffect(()=>{
    if(route.params?.id){
      handleGetGameboxById(String(route.params?.id))
    }
  },[route.params?.id])

  const [gameboxes,setGameboxes] = useState<Gamebox[]>([])


  const handleGetGameboxes = async () => {
     setLoading(true)
    try {
      const gameboxListCollections = await firestore().collection('gamebox').where('userid','==',user.uuid).get();
      const gameboxfirebase = defaultGamebox(user) ? [defaultGamebox(user)] : []
      for (const iterator of gameboxListCollections.docs) {
        const data = iterator.data() as Gamebox
        data.id = iterator.id
        gameboxfirebase.push(data)
      }
      setGameboxes(gameboxfirebase)
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

  useFocusEffect(
    React.useCallback(() => {
      handleGetGameboxes()
    }, [user])
  );
  if(route.params?.id && !gamebox  || loading ){
    return ( 
      <ScrollView contentContainerStyle={{flexGrow: 1}}
      keyboardShouldPersistTaps='handled'>
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
        <Header title="GESTÃO GAMEBOX"></Header>
        </View>
        <View className={`mt-0  p-6 justify-center items-center   flex flex-1 w-full`}>
            <ActivityIndicator color={'#FFFF'} size={24}></ActivityIndicator>
        </View>
      </SafeAreaView>
      </ScrollView>

    )
  }

  return (
    <ScrollView contentContainerStyle={{flexGrow: 1}}
    keyboardShouldPersistTaps='handled'>
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
          <View
            style={{height:Platform.OS === "android" ? 110 : 40}}
            className={`w-full ${Platform.OS == 'ios' ? 'h-10 mb-6' : 'h-10'} flex-row  justify-between items-center`}>
            <TouchableOpacity 
            style={{paddingTop:Platform.OS === "android" ? 20 : 0}}
            className={`w-12 h-12 justify-center items-center`} onPress={()=>navigation.goBack()}>
            <Image  className='h-auto' resizeMode='contain' source={require('../../../assets/arrowLeft.png')}></Image>
            </TouchableOpacity>
            <Text className='font-dinBold h-6 mt-2 text-lg text-titleauth'>
              GESTÃO GAMEBOX
            </Text>
            <TouchableOpacity
             onPress={()=>handlePress()}
             className={`w-12 h-12 justify-center ${Platform.OS == 'android' && 'mt-2'} items-start`} >
            <Image  className='h-auto' resizeMode='contain' source={require('../../../assets/icons/Check_Big.png')}></Image>
            </TouchableOpacity>
          </View>  
      
      </View>
     
      <View className={`mt-0  p-6   flex flex-1 w-full`}>
        <Animated.View  entering={FadeIn.delay(100)} className="flex flex-[0.9] w-full">
          <View className="w-full flex  flex-row">
            {
              gameboxReaded !== null ?
            gameboxReaded.gameboxNumber ?  <Input defaultValue={gameboxReaded.gameboxNumber}  keyboardType="number-pad" autoCapitalize="none" handleGetValue={(value)=>{setGameboxNumber(value)}}   title="NUMERO DA GAMEBOX"></Input>
             : <Input defaultValue={gamebox ? decryptGameBox(gamebox?.gameboxNumber,user.uuid) : ""}  keyboardType="number-pad" autoCapitalize="none" handleGetValue={(value)=>{setGameboxNumber(value)}}   title="NUMERO DA GAMEBOX"></Input>
            : <Input defaultValue={gamebox ? decryptGameBox(gamebox?.gameboxNumber,user.uuid) : ""}   keyboardType="number-pad" autoCapitalize="none" handleGetValue={(value)=>{setGameboxNumber(value)}}   title="NUMERO DA GAMEBOX"></Input>
            }
           <TouchableOpacity 
            onPress={()=>navigation.navigate('Gamebox')}
            className=" object-contain w-8 top-2 right-0 absolute">
                <Image className="h-5 object-contain w-5 " source={require('../../../assets/icons/qrcode.png')} />
            </TouchableOpacity>
          </View>
          <Input defaultValue={gamebox?.gameboxName}  
                 keyboardType="default"
                 autoCapitalize="none"
                 handleGetValue={(value)=>{setGameboxName(value)}}  
                 title="NOME"></Input>
          <Input defaultValue={gamebox?.gameboxPort}  
                 keyboardType="number-pad"
                 autoCapitalize="none"
                 handleGetValue={(value)=>{setGameboxPort(value)}}  
                 title="PORTA"></Input>
          <Input defaultValue={gamebox?.gameboxSector}  
                 keyboardType="default"
                 autoCapitalize="none"
                 handleGetValue={(value)=>{setGameboxSector(value)}}  
                 title="SECTOR"></Input>
         <Input defaultValue={gamebox?.gameboxLine}  
                 keyboardType="number-pad"
                 autoCapitalize="none"
                 handleGetValue={(value)=>{setGameboxLine(value)}}  
                 title="FILA"></Input>
         <Input  defaultValue={gamebox?.gameboxSeat}  
                 keyboardType="number-pad"
                 autoCapitalize="none"
                 handleGetValue={(value)=>{setGameboxSeat(value)}}  
                 title="LUGAR"></Input>
        </Animated.View>
   
        {route.params?.id && <TouchableOpacity 
           onPress={()=>handleDelete()}
          className="flex-row w-full text-center justify-center items-center mt-0"
         >
            <Text className="text-titleauth text-md   font-bold">
            Apagar Gamebox
            </Text>
        </TouchableOpacity> }
      </View>
    </SafeAreaView>
    </ScrollView>
  );
};

export default GameboxMangement;
