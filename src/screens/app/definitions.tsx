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
import { useNavigation } from "@react-navigation/native";
import Header from "../../components/Header";
import Input from "../../components/Input";
import auth from '@react-native-firebase/auth';
import firestore, { firebase } from '@react-native-firebase/firestore';
import { showMessage, hideMessage } from "react-native-flash-message";
import { IUser, useAuthStore } from "../../store/auth.store";
import Animated, { FadeIn } from "react-native-reanimated";
import { decryptGameBox } from "../../services/decryptGameBox";
import CryptoJS from "react-native-crypto-js";
import DateTimePicker from '@react-native-community/datetimepicker';

const Definitions = () => {
  const user = useAuthStore((state) => state.user)
  const login = useAuthStore((state) => state.login)
  const logout = useAuthStore((state) => state.logout)

  const [name,setName] = useState(user.name)
  const [partnerNumber,setParterNumber] = useState(user.partnerNumber)
  const [gameboxNumber,setGameboxNumber] = useState(decryptGameBox(user.gameboxNumber,user.uuid))

  const [loading,setLoading] = useState(false)

  const navigation = useNavigation();

  const handlePress = async () => {
     const usersCollection = firestore().collection('users');
     setLoading(true)

    try {
      if(!name){
        showMessage({
          message: "O nome não pode ser vazio",
          type: "warning",
          color:'#D3D3D3',
          style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
          titleStyle:{fontFamily:'DinBold',lineHeight:20},
          backgroundColor:'#121212',
        });
      }
      const email = user.email
      const passphrase = 'SCP3#$)=:JI)!F5860_'+user.uuid;
      const numberEncprypt = user.gameboxNumber;

      await usersCollection.doc(user.uuid).update({name,partnerNumber,email,gameboxNumber:numberEncprypt})
     
      login({
        email:user.email,
        name,
        uuid:user.uuid,
        gameboxNumber:!gameboxNumber ? "" : numberEncprypt,
        partnerNumber:partnerNumber,
        gameboxLine:user.gameboxLine,
        gameboxPort:user.gameboxPort,
        gameboxSeat:user.gameboxSeat,
        gameboxSector:user.gameboxSector,
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

  const handleDeleteAccount = async () => {

   try {
     Alert.alert(
      'Deseja apagar a conta?',
      'Eliminar Conta',
      [
        {
          text: 'Sim',
          onPress: async () => {
             try {
                const currentUser = auth().currentUser.uid
                await firestore().collection('users')
                .doc(currentUser) // 👈
                .delete()
                await auth().currentUser.delete()
                
                setLoading(false)
                showMessage({
                  message: "Conta Eliminada!",
                  type: "success",
                  color:'#fff',
                  style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
                  titleStyle:{fontFamily:'DinBold',lineHeight:20},
                  backgroundColor:'#003625',
                });
                logout()
             } catch (error) {
              console.log(error)
              showMessage({
                message: "Não foi possível eliminar a conta, tente mais tarde",
                type: "success",
                color:'#fff',
                style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
                titleStyle:{fontFamily:'DinBold',lineHeight:20},
                backgroundColor:'#003625',
              });
             }
          
          },
        },
        {
          text: 'Não',
          style: 'cancel',
        },
      ],
      {
        cancelable: true,
      },
    );
    
   } catch (error) {
     console.log(error.message)
     setLoading(false)
     
   }
 };

  const handleResetPassword = async() => {
      try {
        
        await auth().sendPasswordResetEmail(user.email)
        showMessage({
          message: "Enviamos as instruções para o teu email",
          type: "success",
          color:'#fff',
          style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
          titleStyle:{fontFamily:'DinBold',lineHeight:20},
          backgroundColor:'#003625',
        });
      
      } catch (error) {
        showMessage({
          message: "Não foi possível efetuar a ação! Por favor tente mais tarde.",
          type: "warning",
          color:'#D3D3D3',
          style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
          titleStyle:{fontFamily:'DinBold',lineHeight:20},
          backgroundColor:'#121212',
        });
      }
  }


  return (
    <ScrollView contentContainerStyle={{flexGrow: 1}}
    keyboardShouldPersistTaps='handled'>
    <SafeAreaView className={`bg-bgauth  flex-1 h-full justify-start items-center`}>
       <Image
        className='flex flex-1  absolute h-full w-full'
        source={require('../../assets/opacebg.png')}  >
      </Image>
      <Animated.View 
            style={[{backgroundColor:'#001B13'}]}
            className='flex flex-1 absolute h-full w-full opacity-80'>
          </Animated.View>
          <View className=" mt-2 mt-[5] mb-[-15] w-full ">
      <Header title="CONTA S360"></Header>
      </View>
     
      <View className={`mt-0  p-6   flex flex-1 w-full`}>
        <Animated.View  entering={FadeIn.delay(100)} className="flex flex-[0.9] w-full">
          <Input defaultValue={user.name.toUpperCase()}  handleGetValue={(value)=>{setName(value)}}  onChangeText={setName} title="NOME"></Input>
          <Input maskInput  mask="99/9999" defaultValue={user.partnerNumber}  keyboardType="default" autoCapitalize="none" handleGetValue={(value)=>{setParterNumber(value)}}   title="SÓCIO DESDE"></Input>
          <TouchableOpacity 
      className="flex-row"
      onPress={()=>handleResetPassword()}>
        <Text className="text-titleauth  text-sm   font-dinBold">
         Mudar <Text className="text-titleauth  text-sm   font-dinBold">Password</Text>
        </Text>
      </TouchableOpacity>
        </Animated.View>
        <TouchableOpacity 
            onPress={()=>handlePress()}
            activeOpacity={0.7}
            className='bg-white w-full h-14 justify-center   items-center rounded-full'
          >
         {loading ?
          <ActivityIndicator color={'#00835B'} size={24}></ActivityIndicator>
         : <Text className={`text-titleauth font-dinBold ${Platform.OS === 'ios' ? 'mt-3' : 'mt-0'} text-lg`}>GUARDAR</Text>}
        </TouchableOpacity>
        <TouchableOpacity 
          className="flex-row w-full text-center justify-center items-center mt-4"
          onPress={()=>logout()}>
            <Text className="text-titleauth text-lg   font-medium">
            Log Out
            </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          className="flex-row w-full text-center justify-center items-center mt-4"
          onPress={()=>handleDeleteAccount()}>
            <Text className="text-titleauth text-lg   font-medium">
            Apagar Conta
            </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </ScrollView>
  );
};

export default Definitions;
