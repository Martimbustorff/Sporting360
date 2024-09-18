import React, { useRef, useState } from 'react';
import { View,Text, ScrollView, Dimensions,StyleSheet,Image, Modal, TouchableOpacity } from 'react-native';
import { IStatisticsResponse } from '../../utils/graphql/query/statistics/IStatisticsResponse';
import { IStandingsResponse } from '../../utils/graphql/query/standings/IStandingsResponse';
import { IVideosResponse } from '../../utils/graphql/query/videos/IStatisticsResponse';
import WebView from 'react-native-webview';
import { Video, ResizeMode } from 'expo-av';
// import { Container } from './styles';
import { IVideos } from '../../api/firebase/videos';
interface IVideosProps {
  videos: IVideos[];
}
const Videos: React.FC<IVideosProps> = ({videos}) => {
  const [selectedVideo, setSelectedVideo] = useState<IVideos | null>(null);
  const videoRef = useRef<Video>(null);
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
  const [modalVisible,setModalVisible] = useState(false)
  return <View className='flex flex-col w-full'>
     {videos.length === 0 &&
      <View className='w-full h-40 ml-[-20] justify-center mt-14 items-center'>
      <Image source={require('../../assets/icons/calendarcheck.png')}></Image>
      <Text className='text-lg text-white font-bold font-dinLight'>Disponível no dia de jogo</Text>
      </View>}
      <Video 
               ref={videoRef}
               onTouchEnd={()=>setSelectedVideo(null)}
               useNativeControls
               onFullscreenUpdate={(e)=>{
                if(e.fullscreenUpdate === 3){
                  setTimeout(() => {
                    setSelectedVideo(null)
                  }, 500);
                }
               }}
               resizeMode={ResizeMode.COVER}
                className={`h-0 w-full rounded-xl opacity-0 `}
                source={{
                  uri:selectedVideo?.videoUrl
                }}
      /> 
      {videos.map(k=>{
        return (
          <TouchableOpacity onPress={()=>{
            setSelectedVideo(k)
            setTimeout(() => {
              videoRef.current?.presentFullscreenPlayer();
            }, 500);
          }}
          className='w-80 justify-center items-start mt-3 ml-2'>
            {/* <Video 
               useNativeControls
               resizeMode={ResizeMode.COVER}
                className='h-40 w-full rounded-xl'
                source={{
                  uri:k.videoUrl
                }}
              /> */}
              <Image 
            className='h-40 w-full rounded-xl'
            source={{uri:k.bigpicture}}></Image>
            {/* 
              {/* <Video 
               useNativeControls
               resizeMode={ResizeMode.COVER}
                className='h-40 w-full rounded-xl'
                source={{
                  uri:k.attributes.URL
                }}
              /> */}
                <Text className="text-white w-auto mt-3 ml-[-0] text-sm font-dinLight" >
                  {k.title}
             </Text>
              
          </TouchableOpacity>
        )
      })}
      <Modal
          animationType="slide"
          transparent={true}
          visible={modalVisible}
          onRequestClose={() => {
            setModalVisible(!modalVisible);
          }}>
          <View className='flex h-full rounded-md bg-white_20 justify-end pt-40 items-center '>
            <View className='bg-bgauth  h-full rounded-t-xl  w-full round-md   shadow-xl'>
              <View className='bg-bgauth  h-[90%] rounded-t-xl  w-full round-md  p-6 shadow-xl'>
              <WebView 
              className='h-full w-full rounded-xl'
              source={{
                uri:'https://vsports.pt/vsports/vod/golo-sporting-cp-gyokeres-45-sl-benfica-0-1-sporting-cp-91112'
              }}
            ></WebView>

              </View>
            
                <TouchableOpacity 
                    onPress={()=>setModalVisible(false)}
                  className="flex-row w-full text-center justify-center mt-4  items-center "
                >
                  <Text className="text-titleauth text-lg   font-medium">
                    Fechar 
                      </Text>
                </TouchableOpacity>
            </View>


          </View>
          </Modal>
    <View className='h-72'></View>

  </View>;
}

export default Videos