import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  ActivityIndicator,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Header from "../../components/Header";
import Input from "../../components/Input";
import auth from '@react-native-firebase/auth';
import { showMessage, hideMessage } from "react-native-flash-message";
import { useNavigation } from "@react-navigation/native";

const Reset = () => {
  const [email,setEmail] = useState("")
  const [loading,setLoading] = useState(false)
  const navigation = useNavigation();

  const handleResetPassword = async () =>{

    try {
      await auth().sendPasswordResetEmail(email)
      showMessage({
        message: "Enviamos as instruções para o teu email",
        type: "success",
        color:'#fff',
        style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
       titleStyle:{fontFamily:'DinBold',lineHeight:20},
        backgroundColor:'#003625',
      });
      setLoading(false)
      setTimeout(() => {
        navigation.navigate('Login')
      }, 600);
    } catch (error) {
      setLoading(false)

      console.log(error)
      if (error.code === 'auth/user-not-found') {
        showMessage({
          message: "Não encontramos este email registado.",
          type: "warning",
          color:'#D3D3D3',
          style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
          titleStyle:{fontFamily:'DinBold',lineHeight:20},
          backgroundColor:'#121212',
        });
        return;
      }

      if (error.code === 'auth/invalid-email') {
        showMessage({
          message: "Email inválido",
          type: "warning",
          color:'#D3D3D3',
          style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
          titleStyle:{fontFamily:'DinBold',lineHeight:20},
          backgroundColor:'#121212',
        });
        return;
      }
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
    <View className="h-full p-6 bg-bgauth  w-full">
      <SafeAreaView className="bg-bgauth   flex-1 justify-start items-center">
        <Header title="RECUPERAR PASS"></Header>
        <Text className='text-white_gray font-dinLight mb-4 text-md'>Indica o teu email para receberes as instruções de recuperação da Pass.</Text>

        <View className="mt-6 flex flex-1 w-full">
          <View className="flex flex-[0.9] w-full">
            <Input autoFocus autoCapitalize="none"  keyboardType="email-address" handleGetValue={(value)=>{setEmail(value)}}  title="EMAIL"></Input>
          </View>
          <TouchableOpacity 
              onPress={handleResetPassword}
              activeOpacity={0.7}
              className='bg-white w-full h-14 justify-center items-center rounded-full'
            >
            {loading ?
            <ActivityIndicator color={'#00835B'} size={24}></ActivityIndicator>
          : <Text className={`text-titleauth font-dinBold ${Platform.OS === 'ios' ? 'mt-3' : 'mt-0'} text-lg`}>ENVIAR</Text>} 
          </TouchableOpacity>
        </View>

      </SafeAreaView>
    </View>
  );
};

export default Reset;
