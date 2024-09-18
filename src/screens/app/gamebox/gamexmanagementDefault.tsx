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
  KeyboardAvoidingView,
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
import { useGameboxRead } from "../../../store/gameboxread.store";

const GameboxMangementDefault = () => {
  const user = useAuthStore((state) => state.user)
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)

  const [gameboxNumber,setGameboxNumber] = useState(decryptGameBox(user?.gameboxNumber,user?.uuid))
  const [gameboxLine,setGameboxLine] = useState(user?.gameboxLine)
  const [gameboxPort,setGameboxPort] = useState(user?.gameboxPort)
  const [gameboxName,setGameboxName] = useState(user?.gameboxName)
  const [gameboxSeat,setGameboxSeat] = useState(user.gameboxSeat)
  const [gameboxSector,setGameboxSector] = useState(user?.gameboxSector)
  const addGamebox = useGameboxRead((state) => state.add)
  const gameboxReaded = useGameboxRead((state) => state.gamebox)

  const [loading,setLoading] = useState(false)

  const navigation = useNavigation();

  const handlePress = async () => {
     const usersCollection = firestore().collection('users');
     setLoading(true)
    try {
      const email = user.email
      const name = user.name
      const partnerNumber = user.partnerNumber
      const passphrase = 'SCP3#$)=:JI)!F5860_'+user.uuid;
      const numberEncprypt = CryptoJS.AES.encrypt(String(`${user.uuid}_${gameboxNumber.trim()}`), passphrase).toString();

      await usersCollection.doc(user.uuid).update({
        name,partnerNumber,email,gameboxNumber:numberEncprypt,
        gameboxLine,
        gameboxPort,
        gameboxSeat,
        gameboxSector
      })
     
      login({
        email:user.email,
        name,
        uuid:user.uuid,
        gameboxNumber:!gameboxNumber ? "" : numberEncprypt,
        partnerNumber:partnerNumber,
        gameboxLine,
        gameboxName,
        gameboxPort,
        gameboxSeat,
        gameboxSector,
      })
      setLoading(false)
      showMessage({
        message: "Alterações salvas com sucesso!",
        type: "success",
        color:'#fff',
        style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
        titleStyle:{fontFamily:'DinBold',lineHeight:20},
        backgroundColor:'#003625',
      });
    } catch (error) {
      console.log(error.message)
      setLoading(false)
      showMessage({
        message: "Não foi possível guardar! Por favor tente mais tarde.",
        type: "warning",
        color:'#D3D3D3',
        style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
        titleStyle:{fontFamily:'DinBold',lineHeight:20},
        backgroundColor:'#121212',
      });
    }
  };
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
  if(!user){
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
  if(loading ){
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
    <KeyboardAvoidingView
    className={`bg-bgauth  flex-1 w-full h-full justify-start items-center`}
    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    <SafeAreaView className={`bg-bgauth w-full  flex-1 h-full justify-start items-center`} >
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
             className='w-12 h-12 justify-center items-start' >
            <Image  className='h-auto' resizeMode='contain' source={require('../../../assets/icons/Check_Big.png')}></Image>
            </TouchableOpacity>
          </View>  
      </View>
     
      <View className={`mt-0  p-6   flex flex-1 w-full`}>
        <Animated.View  entering={FadeIn.delay(100)} className="flex flex-[0.8] w-full">
        <View className="w-full flex  flex-row">
            {
              gameboxReaded.gameboxNumber ?
             <Input defaultValue={gameboxReaded.gameboxNumber}  keyboardType="number-pad" autoCapitalize="none" handleGetValue={(value)=>{setGameboxNumber(value)}}   title="NUMERO DA GAMEBOX"></Input>
           : <Input  defaultValue={decryptGameBox(user.gameboxNumber,user.uuid)}   keyboardType="number-pad" autoCapitalize="none" handleGetValue={(value)=>{setGameboxNumber(value)}}   title="NUMERO DA GAMEBOX"></Input>
            }
           <TouchableOpacity 
            onPress={()=>navigation.navigate('Gamebox')}
            className=" object-contain w-8 top-2 right-0 absolute">
                <Image className="h-5 object-contain w-5 " source={require('../../../assets/icons/qrcode.png')} />
            </TouchableOpacity>
          </View>
          <Input defaultValue={user.gameboxName ? user.gameboxName : "Principal"}  
                 keyboardType="default"
                 autoCapitalize="none"
                 handleGetValue={(value)=>{setGameboxName(value)}}  
                 title="NOME"></Input>
          <Input defaultValue={user.gameboxPort}  
                 keyboardType="number-pad"
                 autoCapitalize="none"
                 handleGetValue={(value)=>{setGameboxPort(value)}}  
                 title="PORTA"></Input>
          <Input defaultValue={user.gameboxSector}  
                 keyboardType="default"
                 autoCapitalize="none"
                 handleGetValue={(value)=>{setGameboxSector(value)}}  
                 title="SECTOR"></Input>
         <Input defaultValue={user.gameboxLine}  
                 keyboardType="number-pad"
                 autoCapitalize="none"
                 handleGetValue={(value)=>{setGameboxLine(value)}}  
                 title="FILA"></Input>
         <Input defaultValue={user.gameboxSeat}  
                 keyboardType="number-pad"
                 autoCapitalize="none"
                 handleGetValue={(value)=>{setGameboxSeat(value)}}  
                 title="LUGAR"></Input>
         
        </Animated.View>
       
      </View>
    </SafeAreaView>
    </KeyboardAvoidingView>
  );
};

export default GameboxMangementDefault;
