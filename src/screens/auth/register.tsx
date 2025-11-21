import React, { useEffect, useRef, useState } from "react";
import {
  Text,
  TextInput,
  SafeAreaView,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Header from "../../components/Header";
import Input from "../../components/Input";
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import { showMessage, hideMessage } from "react-native-flash-message";
import { IUser, useAuthStore } from "../../store/auth.store";

const Register = () => {
  const login = useAuthStore((state) => state.login)

  const [name,setName] = useState("")
  const [password,setPassword] = useState("")
  const [email,setEmail] = useState("")
  const [loading,setLoading] = useState(false)

  const navigation = useNavigation();

  const handlePress = async () => {
     const usersCollection = firestore().collection('users');
     setLoading(true)

    try {

      const result = await auth()
      .createUserWithEmailAndPassword(email, password)
      
      await usersCollection.doc(result.user.uid).set({name,email})
      
      showMessage({
        message: "Registo efetuado com sucesso!",
        type: "success",
        color:'#fff',
        style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
        titleStyle:{fontFamily:'DinBold',lineHeight:20},
        backgroundColor:'#003625',
      });
      
      login({
        email,
        name,
        uuid:result.user.uid,
        partnerNumber:"",
      })
      navigation.navigate('Home')
      setLoading(false)
    } catch (error) {
      setLoading(false)
      if (error.code === 'auth/email-already-in-use') {
        showMessage({
          message: "O email já se encontra em uso !",
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
      
      if (error.code === 'auth/weak-password') {
        showMessage({
          message: "Password deve conter no mínimo 6 caracteres",
          type: "warning",
          color:'#D3D3D3',
          style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
          titleStyle:{fontFamily:'DinBold',lineHeight:20},
          backgroundColor:'#121212',
        });
        return;
      }

      showMessage({
        message: "Não foi possível registar! Por favor tente mais tarde.",
        type: "warning",
        color:'#D3D3D3',
        style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
        titleStyle:{fontFamily:'DinBold',lineHeight:20},
        backgroundColor:'#121212',
      });
    }
  };

  return (
    <View className="h-full p-6 bg-bgauth  w-full">
    <SafeAreaView className="bg-bgauth  flex-1 justify-start items-center">
      <Header title="NOVA CONTA"></Header>
      
      <View className="mt-4 flex flex-1 w-full">
        <View className="flex flex-[0.9] w-full">
          <Input handleGetValue={(value)=>{setName(value)}}  autoFocus={true}  onChangeText={setName} title="NOME"></Input>
          <Input  keyboardType="email-address" autoCapitalize="none" handleGetValue={(value)=>{setEmail(value)}}   title="EMAIL"></Input>
          <Input secureTextEntry title="PASSWORD" handleGetValue={(value)=>{setPassword(value)}} ></Input>


          <Text className="text-white opacity-50 mt-[-20] text-xs font-dinRegular text-left">
            Password deve conter no mínimo 6 caracteres
          </Text>
        </View>
        <TouchableOpacity 
            onPress={()=>handlePress()}
            activeOpacity={0.7}
            className='bg-white w-full h-14 justify-center items-center rounded-full mb-4'
          >
         {loading ?
          <ActivityIndicator color={'#00835B'} size={24}></ActivityIndicator>
         : <Text className={`text-titleauth font-dinBold ${Platform.OS === 'ios' ? 'mt-3' : 'mt-0'} text-lg`}>CRIAR CONTA</Text>}
        </TouchableOpacity>
        <TouchableOpacity
        onPress={()=>navigation.navigate('Terms')}
        className="h-10 justify-center items-center flex-col "
        >
        <Text className={`text-white ${Platform.OS === 'ios' ? 'leading-10' : ''} opacity-50 font-dinRegular  text-center`}>
         {'\n'} Ao clicar em criar conta aceita os nossos {'\n'}
        </Text>
        <Text className={`text-white ${Platform.OS === 'ios' ? 'leading-10' : ''} opacity-50 text-titleauth font-dinBold mt-1  text-center`}>Termos e Condições</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
    </View>
  );
};

export default Register;
