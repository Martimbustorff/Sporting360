import React, { useState } from "react";
import {
  SafeAreaView,
  View,
  TextInput,
  TouchableOpacity,
  Text,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import Header from "../../components/Header";
import Input from "../../components/Input";
import { useNavigation } from "@react-navigation/native";
import { showMessage, hideMessage } from "react-native-flash-message";
import auth from '@react-native-firebase/auth';
import { IUser, useAuthStore } from "../../store/auth.store";
import firestore from '@react-native-firebase/firestore';
import Animated, { FadeIn } from "react-native-reanimated";

const Login = () => {
  const login = useAuthStore((state) => state.login)

  const navigation = useNavigation();

  const [password,setPassword] = useState("")
  const [email,setEmail] = useState("")
  const [loading,setLoading] = useState(false)

  const handlePress = async () => {

   try {
     if(!email){
        showMessage({
          message: "Email não pode ser vazio",
          type: "warning",
          color:'#D3D3D3',
          style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
          titleStyle:{fontFamily:'DinBold',lineHeight:20},
          backgroundColor:'#121212',
        });
        return
     }

     if(!password){
      showMessage({
        message: "Password não pode ser vazio",
        type: "warning",
        color:'#D3D3D3',
        style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
        titleStyle:{fontFamily:'DinBold',lineHeight:20},
        backgroundColor:'#121212',
      });
      return
    }
    setLoading(true)

     const result = await auth()
     .signInWithEmailAndPassword(email, password)

   
   
     const userdata = await firestore()
      .collection('users')
      .doc(result.user.uid)
      .get()

    const data = userdata.data() as IUser

     login({
      email:data.email,
      name:data.name,
      partnerNumber:data.partnerNumber ?  data.partnerNumber : "",
      uuid:result.user.uid,
      gameboxNumber:data.gameboxNumber ?  data.gameboxNumber : "",
      gameboxLine:data.gameboxLine ?  data.gameboxLine : "",
      gameboxPort:data.gameboxPort ?  data.gameboxPort : "",
      gameboxSeat:data.gameboxSeat ?  data.gameboxSeat : "",
      gameboxSector:data.gameboxSector ?  data.gameboxSector : "",
     })
     setLoading(false)
     showMessage({
      message: "Login efetuado com sucesso!",
      type: "success",
      color:'#fff',
      style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
      titleStyle:{fontFamily:'DinBold',lineHeight:20},
      backgroundColor:'#003625',
    });
   } catch (error) {
    console.log(error)
     setLoading(false)
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

    if (error.code === 'auth/wrong-password') {
      showMessage({
        message: "Dados inválidos",
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
    <Animated.View  className="h-full p-6 bg-bgauth  w-full">
         <SafeAreaView className="bg-bgauth   flex-1 justify-start items-center">
      <Header  title="ACESSO"></Header>
      <Animated.View entering={FadeIn.delay(100)}  className="mt-4 flex flex-1 w-full">
        <View className="flex flex-[0.9] w-full">
          <Input  autoCapitalize="none" keyboardType="email-address"  handleGetValue={(value)=>{setEmail(value)}} title="EMAIL"></Input>
          <Input  handleGetValue={(value)=>{setPassword(value)}} secureTextEntry={true} title="PASSWORD"  >
         </Input>
        </View>
        <TouchableOpacity 
            onPress={()=>handlePress()}
            activeOpacity={0.7}
            className='bg-white w-full h-14 justify-center items-center rounded-full top-4'
          >
                {loading ?
          <ActivityIndicator color={'#00835B'} size={24}></ActivityIndicator>
         : <Text className={`text-titleauth font-dinBold ${Platform.OS === 'ios' ? 'mt-3' : 'mt-0'} text-lg`}>ENTRAR</Text>}
        </TouchableOpacity>
      </Animated.View>

      <TouchableOpacity 
      className="flex-row"
      onPress={()=>navigation.navigate('Reset')}>
        <Text className="text-white opacity-50 text-sm   font-dinRegular text-center">
         Esqueceste-te da Password?{' '}
        </Text>
        <Text className="text-titleauth  text-sm font-dinBold">
        Recupera-a
        </Text>
      </TouchableOpacity>
      <TouchableOpacity 
      className="flex-row"
      onPress={()=>navigation.navigate('Register')}
      >
        <Text className="text-white text-sm opacity-50 mt-6 mb-6 font-dinRegular text-center">
        Novo utilizador?{' '}
        </Text>
        <Text className="text-titleauth text-sm  font-dinBold mt-6" >
        Cria uma conta
        </Text>
      </TouchableOpacity>
    </SafeAreaView>
    </Animated.View>
 
  );
};

export default Login;
