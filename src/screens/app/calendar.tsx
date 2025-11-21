import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { View,Image,Text,ScrollView, Dimensions, TouchableOpacity, Linking, SafeAreaView, ActivityIndicator, Platform, Modal } from 'react-native';
import Animated, { FadeInUp, interpolateColor, useAnimatedStyle, useSharedValue, withTiming }  from 'react-native-reanimated';
import Header from '../../components/Header';
import Game from '../../components/Calendar/Game';
import { gql, useQuery } from '@apollo/client';
import { IFixture } from '../../interfaces/IFixtures';
import PrincipalGame from '../../components/Calendar/PrincipalGame';
import GamePrognosis from '../../components/Calendar/GamePrognosis';
import ViewShot from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { calendarData } from '../../utils/getCalendarData';
import { GET_GAMES } from '../../utils/graphql/query/games/getGames';
import { IGame, getFeatureGames, getLastGames, getNextGame } from '../../api/firebase/games';


const Calendar = () => {

  // MARK: STATES
  const [index,setIndex] = useState(0)
  const [prevGames,setPrevGames] = useState<IGame[]>([])
  const [featureGames,setFeatureGames] = useState<IGame[]>([])
  const [nextGame,setNextGame] = useState<IGame>(null)

  // MARK: REFS
  const scrollViewRef = useRef()


  // MARK: GET GAMES
  useEffect(()=>{
    const getGames = async ()=>{
      const nextGameResponse = await getNextGame()
      setNextGame(nextGameResponse)
      const featureGamesResponse = await getFeatureGames()
      setFeatureGames(featureGamesResponse)
      const prevGamesResponse = await getLastGames()
      setPrevGames(prevGamesResponse)
    }
    getGames()
  },[])


 
  return <SafeAreaView className={`bg-bgauth  flex-1 h-full justify-start items-center`}>
  <Animated.View 
    entering={FadeInUp.delay(100)}
    className="bg-bgauth flex flex-col mt-0 h-full w-full" >
       <View className="  mt-2 mt-[2] mb-[-15] w-full ">
         <Header title={'AGENDA'}></Header>
      </View>
      {nextGame &&
        <PrincipalGame
            id={Number(nextGame?.api)}
            key={nextGame?.api}
            timestamp={nextGame?.timestamp}
            awayteam={nextGame?.teamaway.name}
            competation={nextGame?.competition}
            hometeam={nextGame?.teamhome.name}
            isStart={Number(nextGame?.elapsedTime) > 0}
            isActive={nextGame?.isActive}
            jorney={nextGame?.journey}
            resultaway={nextGame?.scoreaway}
            resultHome={nextGame?.scorehome}
            uriAwayLogo={nextGame?.teamaway.logo}
            elapseTime={nextGame?.elapsedTime}
            uriLogo={nextGame?.teamhome.logo}
          />
      }
       <View className='w-full pl-4 pr-4'>
          <View className='w-full mt-3 flex-row justify-between   bg-white_20 rounded-md h-11'>
          <TouchableOpacity
            onPress={()=>{
              const newIndex = index === 1 ? 0 : 1
              scrollViewRef.current?.scrollTo({x: Dimensions.get('window').width * newIndex, animated: true});
            }}
          className={`justify-center ${index === 0 && ' border-b-2 border-b-white'}  w-1/2 items-center`}>
                <Text className={`text-white text-base ${index !== 0 && 'opacity-50'} ${Platform.OS === 'ios' && 'pt-3'} font-dinRegular`}>Próximos</Text>
            </TouchableOpacity>
            <TouchableOpacity 
            onPress={()=>{
              const newIndex = index === 1 ? 0 : 1
              scrollViewRef.current?.scrollTo({x: Dimensions.get('window').width * newIndex, animated: true});
            }}
            className={`justify-center ${index === 1 && ' border-b-2 border-b-white'}  w-1/2 items-center`}>
                <Text className={`text-white text-base ${index !== 1 && 'opacity-50'} ${Platform.OS === 'ios' && 'pt-3'} font-dinRegular`}>Resultados</Text>
            </TouchableOpacity>
          </View>
          <ScrollView 
            showsHorizontalScrollIndicator={false}
            horizontal= {true}
            ref={scrollViewRef}
            
            decelerationRate={0}
            onScroll={(x)=>{
              
              setIndex(x.nativeEvent.contentOffset.x > 0 ? 1 : 0)
            }}
            snapToInterval={Dimensions.get('window').width}
          >
              <ScrollView 
                contentContainerStyle={{paddingBottom:featureGames.length*16,width:Dimensions.get('window').width}}>
                  {featureGames.map(game=>{
                    return (
                      <Game 
                            id={game?.api}
                            key={game?.api}
                            timestamp={game?.timestamp}
                            awayteam={game?.teamaway.name}
                            competation={game?.competition}
                            hometeam={game?.teamhome.name}
                            jorney={game?.journey}
                            resultaway={game?.scoreaway}
                            resultHome={game?.scorehome}
                            uriAwayLogo={game?.teamaway.logo}
                            uriLogo={game?.teamhome.logo}
                        />
                    )
                  })}
                 
              </ScrollView>
              <ScrollView  contentContainerStyle={{paddingBottom:featureGames.length*16,width:Dimensions.get('window').width}}>
                  {prevGames.map(game=>{
                    return (
                      <Game 
                          id={game?.api}
                          key={game?.api}
                          timestamp={game?.timestamp}
                          awayteam={game?.teamaway.name}
                          competation={game?.competition}
                          hometeam={game?.teamhome.name}
                          isLast={true}
                          jorney={game?.journey}
                          resultaway={game?.scoreaway}
                          resultHome={game?.scorehome}
                          uriAwayLogo={game?.teamaway.logo}
                          uriLogo={game?.teamhome.logo}
                        />
                    )
                  })}
              </ScrollView>
          </ScrollView>
      </View>

  </Animated.View>

    
  </SafeAreaView>
}

export default Calendar;