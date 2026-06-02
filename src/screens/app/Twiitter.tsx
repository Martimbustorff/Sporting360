import React from "react";
import {
  Image,
  Platform,
  SafeAreaView,
  TouchableOpacity,
  View,
  Text,
} from "react-native";
import Animated, {FadeInUp} from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";
import { WebView } from 'react-native-webview';

export const Twitter = ({ route }: any) => {
  const { username, tweetId } = route.params;
  const navigation = useNavigation();
  const url = `https://x.com/${username}/status/${tweetId}`;
  console.log(url);
  return (
    <SafeAreaView className={`bg-bgauth flex-1 h-full justify-start items-center pb-16`}>
      <Image
        className="flex flex-1 absolute h-full w-full"
        source={require("../../assets/opacebg.png")}
      />
      <Animated.View style={{ backgroundColor: "#001B13" }} className="absolute h-full w-full opacity-80" />

      <View className="mt-2 w-full">
        {/* Header */}
        <View
          style={{ height: Platform.OS === "android" ? 60 : 40, paddingTop: 30 }}
          className={`w-full ${Platform.OS == "ios" ? "h-10 mb-6" : "h-10"} flex-row justify-center items-center`}
        >
          <TouchableOpacity
            style={{ paddingTop: Platform.OS === "android" ? 35 : 0 }}
            className="w-12 h-12 absolute left-2 items-center"
            onPress={() => navigation.goBack()}
          >
            <Image
              className="h-auto"
              resizeMode="contain"
              source={require("../../assets/arrowLeft.png")}
            />
          </TouchableOpacity>
          <Text className="font-dinBold h-6 mt-2 text-lg text-titleauth">NEWS</Text>
        </View>

        <Animated.View
          entering={FadeInUp.delay(100)}
          className="flex flex-col mt-8 h-full w-full" >
          <WebView
            className='h-full flex-1 w-full'
            source={{ uri: url }}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

//689-0674