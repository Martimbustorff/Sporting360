import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    SafeAreaView,
    Animated,
    Vibration,
    Dimensions,
    Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Background } from '../../../components/Home/Background';
import EncryptedStorage from 'react-native-encrypted-storage';
import { IUser, useAuthStore } from "../../../store/auth.store";
import { showMessage, hideMessage } from "react-native-flash-message";
import firestore from '@react-native-firebase/firestore';
import Header from '../../../components/Header';

import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();

const { width, height } = Dimensions.get("window");

const PasscodeLoginScreen = () => {
    const navigation = useNavigation();
    const [passcode, setPasscode] = useState("");
    const [shakeAnimation] = useState(new Animated.Value(0));
    const login = useAuthStore((state) => state.login)
    const [loading, setLoading] = useState(false)

    const handleNumberPress = (number: string) => {
        if (passcode.length < 4) {
            const InputPasscode = passcode + number
            setPasscode((prev) => prev + number);
            if (passcode.length === 3) {
                setTimeout(() => handleConfirm(InputPasscode), 100); // Delay to allow the state update
            }
        }
    };

    const handleDelete = () => {
        setPasscode((prev) => prev.slice(0, -1));
    };

    const handleConfirm = async (InputPasscode: string) => {
        try {
            // Retrieve the stored passcode for the specific email
            const existingCredentials = storage.getString('passcodecert');
            let credentialsArray = existingCredentials ? JSON.parse(existingCredentials) : [];
            // Check for duplicates
            const LoginwithPasscode = credentialsArray.find(cred => cred.passcode === InputPasscode);
            if (LoginwithPasscode) {
                const userdata = await firestore()
                    .collection('users')
                    .doc(LoginwithPasscode.userId)
                    .get()

                const data = userdata.data() as IUser

                console.log("User Data:::", LoginwithPasscode);
                login({
                    email: data.email,
                    name: data.name,
                    partnerNumber: data.partnerNumber ? data.partnerNumber : "",
                    uuid: LoginwithPasscode.userId,
                    gameboxNumber: data.gameboxNumber ? data.gameboxNumber : "",
                    gameboxLine: data.gameboxLine ? data.gameboxLine : "",
                    gameboxPort: data.gameboxPort ? data.gameboxPort : "",
                    gameboxSeat: data.gameboxSeat ? data.gameboxSeat : "",
                    gameboxSector: data.gameboxSector ? data.gameboxSector : "",
                } as IUser)
                setLoading(false)
                showMessage({
                    message: "Login efetuado com sucesso!",
                    type: "success",
                    color: '#fff',
                    style: { height: 120, paddingTop: Platform.OS === 'ios' ? 30 : 60 },
                    titleStyle: { fontFamily: 'DinBold', lineHeight: 20 },
                    backgroundColor: '#003625',
                });
                navigation.navigate("Home")
            }
            else {
                console.error("Please Input Correct Passcode");
                shakeCircles()
                setPasscode("")
            }
        }
        catch (error) {
            shakeCircles()
            setPasscode("")
            console.error("Error retrieving passcode:", error);
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
                        className={`w-8 h-8 rounded-full border-4 border-white ${index < passcode.length ? 'bg-[#00835B]' : 'bg-white'}`}
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
                        className="w-1/4 aspect-square justify-center items-center rounded-full mt-2 mb-2 mr-3 ml-3"
                        style={{ backgroundColor: 'rgba(0, 131, 91, 0.8)' }}
                        onPress={() => handleNumberPress(number.toString())}
                    >
                        <Text className={`text-4xl font-dinCondensed text-white`}>{number}</Text>
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
            <Background />
            <Animated.View
                className="flex flex-col mt-0 h-[90%] w-full justify-between items-center "
            >
                <View className='justify-center items-center mt-20'>
                    <Text className='text-3xl font-dinCondensed mt-10 mb-10 text-white'>
                        Enter Passcode
                    </Text>
                    {renderCircles()}
                </View>
                {renderNumbers()}
            </Animated.View>
            <TouchableOpacity
                className="flex-row w-full text-center justify-center items-center"
                onPress={() => {navigation.navigate("Login")}}>
                <Text className="text-[#00f0f0] text-xl   font-medium">
                    Login with Email
                </Text>
            </TouchableOpacity>
        </SafeAreaView>
    );
};

export default PasscodeLoginScreen;
