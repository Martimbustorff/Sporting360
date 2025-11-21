import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  Animated,
  Vibration,
  SafeAreaView,
  StyleSheet,
  Platform
} from 'react-native';
import Header from '../../../components/Header';
import { Background } from '../../../components/Home/Background';
import auth from '@react-native-firebase/auth';
import EncryptedStorage from 'react-native-encrypted-storage';
import { showMessage, hideMessage } from "react-native-flash-message";
import { MMKV } from 'react-native-mmkv';
import { BlurView } from 'expo-blur';
import { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated"

const storage = new MMKV();
const { width, height } = Dimensions.get("window");

const SetPasscodeScreen = () => {
  const navigation = useNavigation();
  const [passcode, setPasscode] = useState("");
  const [confirmPasscode, setConfirmPasscode] = useState("");
  const [isConfirming, setIsConfirming] = useState(false);
  const [shakeAnimation] = useState(new Animated.Value(0));
  const handleNumberPress = (number: string) => {
    if (isConfirming) {
      if (confirmPasscode.length < 4) {
        const newConfirmPasscode = confirmPasscode + number;
        setConfirmPasscode((prev) => {
          const newConfirmPasscode = prev + number;
          return newConfirmPasscode;
        });
        if (confirmPasscode.length === 3) {
          setTimeout(() => handleConfirm(newConfirmPasscode), 100); // Delay to allow the state update
        }
      }
    } else {
      if (passcode.length < 4) {
        setPasscode((prev) => prev + number);
        if (passcode.length === 3) {
          setTimeout(() => setIsConfirming(true), 100); // Delay to allow the state update
        }
      }
    }
  };

  const handleDelete = () => {
    if (isConfirming) {
      setConfirmPasscode((prev) => prev.slice(0, -1));
    } else {
      setPasscode((prev) => prev.slice(0, -1));
    }
  };

  const handleConfirm = async (newConfirmPasscode: string) => {
    console.log("hello I am handle confirm")
    if (passcode === newConfirmPasscode) {
      const userId = auth().currentUser?.uid
      try {
        const existingCredentials = storage.getString('passcodecert');
        let credentialsArray = existingCredentials ? JSON.parse(existingCredentials) : [];
        // Check for duplicates
        const isDuplicatePasscode = credentialsArray.some(cred => cred.passcode === passcode);
        const isDuplicateUid = credentialsArray.some(cred => cred.userId === userId);
        if (isDuplicatePasscode) {
          showMessage({
            message: "O registo falhou devido a uma palavra-passe duplicada",
            type: "warning",
            color: '#fff',
            style: { height: 120, paddingTop: Platform.OS === 'ios' ? 30 : 60 },
            titleStyle: { fontFamily: 'DinBold', lineHeight: 20 },
            backgroundColor: '#003625',
          });
          setConfirmPasscode("")
          setPasscode("")
          setIsConfirming(false)
          shakeCircles()
        }
        else if (isDuplicateUid) {
          const userIndex = credentialsArray.findIndex(cred => cred.userId === userId);
          credentialsArray[userIndex].passcode = newConfirmPasscode;
          storage.set('passcodecert', JSON.stringify(credentialsArray));
          showMessage({
            message: "Palavra-passe alterada corretamente",
            type: "success",
            color: '#fff',
            style: { height: 120, paddingTop: Platform.OS === 'ios' ? 30 : 60 },
            titleStyle: { fontFamily: 'DinBold', lineHeight: 20 },
            backgroundColor: '#003625',
          });
          console.log("Passcode saved:", passcode, credentialsArray);
          navigation.goBack();
        }
        else {
          credentialsArray.push({ passcode, userId });
          storage.set('passcodecert', JSON.stringify(credentialsArray));
          showMessage({
            message: "Senha guardada corretamente",
            type: "success",
            color: '#fff',
            style: { height: 120, paddingTop: Platform.OS === 'ios' ? 30 : 60 },
            titleStyle: { fontFamily: 'DinBold', lineHeight: 20 },
            backgroundColor: '#003625',
          });
          console.log("Passcode saved:", passcode, credentialsArray);
          navigation.goBack();
        }
      }
      catch (error) {
        console.error('Error saving credentials:', error);
        setConfirmPasscode("")
        setPasscode("")
        setIsConfirming(false)
        shakeCircles()
      }
    } else {
      // Shake animation and reset
      shakeCircles();
      setConfirmPasscode("");
    }
  };

  const shakeCircles = () => {
    Vibration.vibrate(500); // Vibrate for 500ms
    Animated.sequence([
      Animated.timing(shakeAnimation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: -10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 10, duration: 100, useNativeDriver: true }),
      Animated.timing(shakeAnimation, { toValue: 0, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const renderCircles = () => {
    const currentPasscode = isConfirming ? confirmPasscode : passcode;
    const circles = Array(4).fill(0);
    return (
      <Animated.View
        style={[
          { transform: [{ translateX: shakeAnimation }] },
        ]}
        className="flex-row justify-between w-2/5"
      >
        {circles.map((_, index) => (
          <View
            key={index}
            className={`w-8 h-8 rounded-full border-4 border-white ${index < currentPasscode.length ? 'bg-[#00835B]' : 'bg-white'}`}
          />
        ))}
      </Animated.View>
    );
  };

  const renderNumbers = () => {
    const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0];
    return (
      <View className="flex-row flex-wrap justify-center items-center p-10">
        {numbers.map((number) => (
          <TouchableOpacity
            key={number}
            className="w-1/4 aspect-square justify-center items-center rounded-full mt-2 mb-2 mr-3 ml-3 blur-[20]"
            style={{ aspectRatio: 1, borderRadius: 9999, overflow: 'hidden' }}
            onPress={() => handleNumberPress(number.toString())}
          >
            <BlurView intensity={10} style={{
              width: '100%',
              height: '100%',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 131, 91, 0.6)',
            }}>
              <Text className={`text-4xl font-dinCondensed text-white `}>{number}</Text>
            </BlurView>
          </TouchableOpacity>

        ))}
        <TouchableOpacity className={`w-1/4 h-1/4 justify-center items-center absolute m-10`} style={{ right: width / 16, bottom: 0 }} onPress={handleDelete}>
          <Text className="text-5xl font-dinLight text-white">⌫</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView className="bg-background flex-1 h-full justify-start items-center">
      {/* <Background /> */}
      <Animated.Image
        className="flex flex-1 top-20 absolute h-full w-full"
        source={require("../../../assets/bghome.png")}
      ></Animated.Image>
      <Animated.Image
        className='flex flex-1 top-0 absolute h-96 w-full'
        source={require('../../../assets/Circle2.png')}  >
      </Animated.Image>
      <Animated.View
        style={[{ backgroundColor:'rgba(0, 54, 37, 0.5)'}]}
        className=' absolute h-full w-full'>
      </Animated.View>
      <View className="mb-1 mt-2 mt-[2] w-full">
        <Header title={''} />
      </View>
      <Animated.View
        className="flex flex-col mt-0 h-[85%] w-full justify-between items-center "
      >
        <View className='justify-center items-center'>

          <Text className='text-6xl font-dinCondensed mt-[-10] text-white'>
            <Text className='color-[#00835B]'>S</Text>360
          </Text>
          <Text className='text-2xl font-dinLight mt-6 mb-6 text-white'>
            {isConfirming ? "Repete os mesmo 4 digitos" : "Introduz 4 digitos"}
          </Text>
          {renderCircles()}
        </View>
        {renderNumbers()}
      </Animated.View>
    </SafeAreaView>
  );
};


export default SetPasscodeScreen;
