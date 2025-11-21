import React, { useRef, useState } from 'react';
import { View, Text, ScrollView, Dimensions, StyleSheet, Image, Modal, TouchableOpacity } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { IVideos } from '../../api/firebase/videos';
import { SafeAreaView } from 'react-native-safe-area-context';
import WebView from 'react-native-webview';
import VideoShow from './VideoShow';
import { useNavigation } from '@react-navigation/native';
interface IVideosProps {
  videos: IVideos[];
}
const Videos: React.FC<IVideosProps> = ({ videos }) => {

  const navigation = useNavigation();

  const [selectedVideo, setSelectedVideo] = useState<IVideos | null>(null);
  const videoRef = useRef<Video>(null);
  const webViewRef = useRef<WebView>(null);
  const styles = StyleSheet.create({
    heading: {
      borderBottomWidth: 1,
      borderColor: '#000000',
    },
    heading1: {
      fontSize: 32,
      backgroundColor: '#000000',
      color: '#FFFFFF',
    },
    heading2: {
      fontSize: 24,
    },
    heading3: {
      fontSize: 18,
    },
    heading4: {
      fontSize: 16,
    },
    heading5: {
      fontSize: 13,
    },
    heading6: {
      fontSize: 11,
    }
  });
  
  return (
    <View className='flex flex-col w-full flex-1'>
    {videos.length === 0 &&
      <View className='w-full justify-center mt-14 items-center pr-10'>
        <Image source={require('../../assets/icons/calendarcheck.png')}></Image>
        <Text className='text-lg text-white font-bold font-dinLight'>Disponível no dia de jogo</Text>
      </View>}
    {videos.map(k => {
      return (
        <TouchableOpacity onPress={() => {
          setSelectedVideo(k)
          setTimeout(() => {
            videoRef.current?.presentFullscreenPlayer();
            navigation.navigate("VideoShow", {selectedVideoLink: k.videoUrl});
          }, 500);
        }}
          className='w-full justify-center items-start mt-3 pl-2 pr-10'>
          <Image
            className='h-40 w-full rounded-xl'
            source={{ uri: k.bigpicture }}></Image>
          <Text className="text-white w-auto mt-3 ml-[-0] text-sm font-Poppins" >
            {k.title}
          </Text>

        </TouchableOpacity>
      )
    })}
   
    <View className='h-72'></View>

  </View>
  );
}

export default Videos