import React, { useEffect, useRef, useState } from "react";
import {
  Text,
  SafeAreaView,
  TouchableOpacity,
  View,
  Platform,
  Dimensions,
  StatusBar,
  ActivityIndicator
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { CameraView, useCameraPermissions } from "expo-camera";
import { showMessage } from "react-native-flash-message";
import { Popup } from "react-native-popup-confirm-toast";
import { useAuthStore } from "../../../store/auth.store";
import Header from "../../../components/Header";
import { useGameboxRead } from "../../../store/gameboxread.store";

const Gamebox = () => {
  const [permission, requestPermission] = useCameraPermissions();
  const user = useAuthStore((state) => state.user)
  const navigation = useNavigation();
  const [stop, setStop] = useState(false)
  const login = useAuthStore((state) => state.login)
  const addGamebox = useGameboxRead((state) => state.add)
  const [scanned, setScanned] = useState(false);
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;


  useEffect(() => {
    if (!permission || permission.status !== 'granted') {
      requestPermission();
    }
  }, [permission, requestPermission]);


  if (!permission) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D1B2A' }}>
        <ActivityIndicator size="large" color="#6AE36E" />
        <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Loading permissions...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View className="bg-bgauth  flex-1 justify-between items-center">
        <Text className="text-white leading-5  text-md text-center  font-dinBold">We need your permission to access the camera</Text>
        <TouchableOpacity
          className = "border-5 w-24 h-12"
          onPress={async () => {
            const result = await requestPermission();
            console.log('Permission Result:', result);
          }}
        >
          <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }
  const handleBarCodeScanned = async ({ data, raw }: any) => {
    setScanned(true); // Stop further scanning

    Popup.show({
      type: 'confirm',
      title: 'Número da Gamebox - ' + data.trim(),
      textBody: 'Por favor, confirme se o número lido pela nossa aplicação está correto. Se estiver, prossiga para desfrutar das emoções do Sporting; caso contrário, verifique novamente',
      buttonText: 'Confirmar',
      confirmText: 'Corrigir',
      okButtonStyle: { backgroundColor: '#003625' },
      callback: async () => {
        Popup.hide();
        await addGamebox({
          gameboxNumber: data.trim(),
        });
        showMessage({
          message: "Gamebox lida com sucesso",
          type: "warning",
          color: '#D3D3D3',
          style: { height: 120, paddingTop: Platform.OS === 'ios' ? 30 : 60 },
          titleStyle: { fontFamily: 'DinBold', lineHeight: 20 },
          backgroundColor: '#121212',
        });
        navigation.goBack(); // Navigate back after confirmation
      },
      cancelCallback: () => {
        setStop(false); // Resume scanning if the user chooses to correct
        Popup.hide();
      },
    });
  };
  return (
    <SafeAreaView className={`bg-bgauth  flex-1 justify-between items-center`}>
      <View className=" pl-6 w-full ">
        <Header title="Gamebox"></Header>
      </View>
      {Platform.OS === "android" ? <StatusBar hidden /> : null}
      <CameraView
        className="w-full p-4 absolute justify-center items-center"
        style={{ width: screenWidth * 0.8, height: screenHeight * 0.7 }}
        barcodeScannerSettings={{
          barcodeTypes: ['qr']
        }}
        onBarcodeScanned={(data) => { handleBarCodeScanned(data) }}
      />
      <TouchableOpacity
        className="flex-row w-full text-center justify-center mt-4 mb-4 items-center "
        onPress={() => navigation.goBack()}>
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
