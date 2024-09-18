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
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import Animated, { FadeIn } from "react-native-reanimated";
import { BarCodeScanner } from "expo-barcode-scanner";
import firestore from '@react-native-firebase/firestore';
import { showMessage } from "react-native-flash-message";
import { Popup } from "react-native-popup-confirm-toast";
import CryptoJS from "react-native-crypto-js";
import Lottie from 'lottie-react-native';
import { useAuthStore } from "../../../store/auth.store";
import Header from "../../../components/Header";
import { useGameboxRead } from "../../../store/gameboxread.store";

const Gamebox = () => {
  const user = useAuthStore((state) => state.user)
  const navigation = useNavigation();
  const [stop,setStop] = useState(false)
  const login = useAuthStore((state) => state.login)
  const addGamebox = useGameboxRead((state) => state.add)

  

  const askForCameraPermission = async () => {
    const { status } = await BarCodeScanner.requestPermissionsAsync();
  };
  
  useEffect(()=>{
    askForCameraPermission()
  },[])
  const handleBarCodeScanned = async ({ type, data }) => {
    setStop(true)
   
    Popup.show({
      type: 'confirm',
      title: 'Número da Gamebox - ' + data.trim(),
      textBody: 'Por favor, confirme se o número lido pela nossa aplicação está correto. Se estiver, prossiga para desfrutar das emoções do Sporting; caso contrário, verifique novamente',
      buttonText: 'Confirmar',
      confirmText: 'Corrigir',
      okButtonStyle:{backgroundColor:'#003625'},
      callback: async () => {
              Popup.hide();
              addGamebox({
                gameboxNumber:data.trim()
              })
              showMessage({
                message: "Gamebox lida com sucesso " ,
                type: "warning",
                color:'#D3D3D3',
                style:{height:120,paddingTop:Platform.OS === 'ios' ? 30 : 60},
                titleStyle:{fontFamily:'DinBold',lineHeight:20},
                backgroundColor:'#121212',
              });
              
             navigation.goBack()
            },
            cancelCallback: () => {
              setStop(false)

                Popup.hide();
            },
  })
   
  };

  return (
    <SafeAreaView className={`bg-bgauth  flex-1 h-full justify-start items-center`}>
          <View className=" pl-6   w-full ">
      <Header title="Gamebox"></Header>
      </View>
      <BarCodeScanner
                      onBarCodeScanned={stop ? ()=>{} : handleBarCodeScanned}
                      className="h-[80%] w-full p-4 flex justify-center items-center"
                    >
                      <Lottie source={require('../../../assets/animations/scanner.json')} autoPlay loop />
                    </BarCodeScanner>

        <TouchableOpacity 
          className="flex-row w-full text-center justify-center mt-4 mb-4 items-center "
          onPress={()=>navigation.goBack()}>
            <Text className="text-white leading-5  text-md text-center  font-dinBold">
               Não consegue digitalizar ?  {'\n'}
              <Text className="text-titleauth mt-4 text-md text-center   font-dinBold">
               Insira Manualmente
               </Text>
            </Text>
          
        </TouchableOpacity>
    </SafeAreaView>
  );
};

export default Gamebox;
