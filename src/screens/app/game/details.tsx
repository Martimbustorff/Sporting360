import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, TouchableOpacity, View,Text, ScrollView, Platform,Image, Dimensions, Modal } from 'react-native';
import Animated, { FadeIn, FadeInUp }  from 'react-native-reanimated';
import { gql, useQuery } from '@apollo/client';
import Header from '../../../components/Header';
import { GET_GAME_BY_ID } from '../../../utils/graphql/query/games/getGameById';
import { IGameByIdResponse } from '../../../utils/graphql/query/games/IGamesResponse';
import PrincipalGame from '../../../components/Calendar/PrincipalGame';
import DetailGame from '../../../components/Calendar/DetailGame';
import { GET_SUMMARIES_BY_ID } from '../../../utils/graphql/query/summaries/getSummariesByGame';
import { ISummariesResponse } from '../../../utils/graphql/query/summaries/ISummariesResponse';
import Summary from '../../../components/GameDetail/Summary';
import { GET_STATISTICS_BY_ID } from '../../../utils/graphql/query/statistics/getStatistics';
import { IStatisticsResponse } from '../../../utils/graphql/query/statistics/IStatisticsResponse';
import Statistics from '../../../components/GameDetail/Statistics';
import { GET_STANDINGS } from '../../../utils/graphql/query/standings/getStandings';
import Standings from '../../../components/GameDetail/Standings';
import { IStandingsResponse } from '../../../utils/graphql/query/standings/IStandingsResponse';
import { GET_VIDEOS_BY_GAME } from '../../../utils/graphql/query/videos/getVideos';
import { IVideosResponse } from '../../../utils/graphql/query/videos/IStatisticsResponse';
import Videos from '../../../components/GameDetail/Videos';
import ViewShot from 'react-native-view-shot';
import GamePrognosis from '../../../components/Calendar/GamePrognosis';
import * as Sharing from 'expo-sharing';
import { ISummary, getSummariesByGameId } from '../../../api/firebase/summary';
import { IGame, getGameById, getNextGame } from '../../../api/firebase/games';
import { IStastistics, getStastisticsByGameId } from '../../../api/firebase/stastics';
import { IStandings, getStandingsByCompetation } from '../../../api/firebase/standings';
import { firebase } from "@react-native-firebase/firestore";
import { IVideos, getVideosByGameId } from '../../../api/firebase/videos';
import ManOfTheMatch from '../../../components/GameDetail/ManOfTheMatch';
import { ILineups, getLineupsByGameId } from '../../../api/firebase/lineups';
import { IManOfTheMatch, getManOfTheMatch } from '../../../api/firebase/manOfTheMatch';

const GameDetail = () => {
  const [index,setIndex] = useState(0)
  const [summaries,setSummaries] = useState<ISummary[]>(null)
  const [statistics,setStatistics] = useState<IStastistics[]>(null)
  const [standings,setStandings] = useState<IStandings[]>(null)
  const [videos,setVideos] = useState<IVideos[]>(null)
  const [lineups,setLineups] = useState<ILineups[]>(null)
  const [manOfTheMatch,setManOfTheMatch] = useState<IManOfTheMatch[]>(null)

  const [game,setGame] = useState<IGame>(null)

  // MARK: REFS
  const scrollViewRef = useRef()

  // MARK : ROUTES
  const {params} = useRoute()
  const { id } = params
  
  const [modalVisible,setModalVisible] = useState(false)
  const [cursor, setCursor] = useState<string | null>(null);
  const ref = useRef();
  const openModal = () =>{
    setModalVisible(true)
  }
  const subscribeGame = async (game:IGame) => {
    const nextGame = await getNextGame()
    if(nextGame.api === game.api){
      const subscriberGame = firebase.firestore()
      .collection('games')
      .doc(game.id)
      .onSnapshot(documentSnapshot => {
        console.log('User data: ', documentSnapshot.data());
        setGame(documentSnapshot.data() as IGame)
      });
      const subscriberSummary = firebase.firestore()
      .collection('summaries')
      .where('GameId', '==', game.api)
      .onSnapshot(documentSnapshot => {
        const summary =   documentSnapshot.docs.map(doc => doc.data()) as ISummary[];
        setSummaries(summary)
      });
      const subscriberStastisics = firebase.firestore()
      .collection('stastistics')
      .where('GameId', '==', game.api)
      .onSnapshot(documentSnapshot => {
        const stastistics =   documentSnapshot.docs.map(doc => doc.data()) as IStastistics[];
        setStatistics(stastistics)
      });
      return () => {
        subscriberGame()
        subscriberStastisics()
        subscriberSummary()
      };
    }
  }
  const handleRefreshManofTheMatch = async () => {
    const manOfTheMatchdata = await getManOfTheMatch(id)
    setManOfTheMatch(manOfTheMatchdata)
  }
  const sharePrognosis = () => {
    ref?.current?.capture().then(uri => {
      Sharing.shareAsync(uri,{
        dialogTitle:"Partilha o teu S360 Prognóstico",
      })
      console.log("do something with ", uri);
    });
 
}
  useEffect(()=>{
    const getSummaries = async () => {
      const game = await getGameById(id)
      setGame(game)
      const summariesdata = await getSummariesByGameId(id)
      console.log("SUMMARIO ???")
      console.log(summaries)
      setSummaries(summariesdata)
      const statisticsdata = await getStastisticsByGameId(id)
      setStatistics(statisticsdata)
      const standingsdata = await getStandingsByCompetation(game.competition)
      setStandings(standingsdata)
      const videosdata = await getVideosByGameId(id)
      setVideos(videosdata)
      const lineupsdata = await getLineupsByGameId(id)
      setLineups(lineupsdata)
      const manOfTheMatchdata = await getManOfTheMatch(id)
      setManOfTheMatch(manOfTheMatchdata)
      subscribeGame(game)
    }
    getSummaries()
  },[])

  if(!summaries && !game){
    return (
       <SafeAreaView className={`bg-bgauth  flex-1 h-full justify-start items-center`}>
         <Animated.View 
           entering={FadeInUp.delay(100)}
           className="bg-bgauth flex flex-col mt-0 h-full w-full" >
             <View className="  mt-2 mt-[2] mb-[-15] w-full ">
               <Header title={'AGENDA'}></Header>
             </View>
         </Animated.View>
       </SafeAreaView>
    )
  }

  const listItems = [
    {
    name:"Sumário",
    index:0
    },
    {
      name:"Estatisticas",
      index:1
    },
    {
      name:"Classificação",
      index:2
    },
    {
      name:"Videos",
      index:3
    },
    {
      name:"MVP",
      index:4
    },
   ]

 
  
 return <SafeAreaView className={`bg-bgauth  flex-1 h-full justify-start items-center`}>
  <Animated.View 
    entering={FadeIn.delay(100)}
    className="bg-bgauth flex flex-col mt-0 h-full w-full" >
       <View className="  mt-2 mt-[2] mb-[-15] w-full ">
          <Header hideBackButton={false} title={game.competition}></Header>
        </View>
        <DetailGame
         id={Number(game?.api)}
         key={game?.api}
         timestamp={game?.timestamp}
         awayteam={game?.teamaway.name}
         competation={game?.competition}
         hometeam={game?.teamhome.name}
         isStart={Number(game?.elapsedTime) > 0}
         jorney={game?.journey}
         resultaway={game?.scoreaway}
         resultHome={game?.scorehome}
         uriAwayLogo={game?.teamaway.logo}
         elapsedTime={game?.elapsedTime}
         uriLogo={game?.teamhome.logo}
          />
        <View className='w-full pl-4 pr-4'>

          <View className='w-full mt-3 flex-row justify-center items pr-4 pl-4   bg-white_20 rounded-md h-11'>
            <ScrollView horizontal={true}>
            {listItems.map(item=>{
                return (
                  <TouchableOpacity
                  onPress={()=>{
                   scrollViewRef.current?.scrollTo({x: Dimensions.get('window').width * item.index, animated: true});
                 }}
                  className={`justify-center ${index ===  item.index && ' border-b-2 border-b-white'}  flex mr-2 items-center`}
               >
                 <Text
                 onPress={()=>{
                   scrollViewRef.current?.scrollTo({x: Dimensions.get('window').width *  item.index, animated: true});
                 }}
                 className={`text-white text-base ${index !== item.index && 'opacity-50'} ${Platform.OS === 'ios' && 'pt-3'} font-dinRegular`}
                 >{item.name}</Text>
               </TouchableOpacity>
                )
              })}
            </ScrollView>
           
          </View>
          <ScrollView 
            showsHorizontalScrollIndicator={false}
            horizontal= {true}
            ref={scrollViewRef}
            decelerationRate={0}
            onScroll={(x)=>{
              setIndex(Math.round(x.nativeEvent.contentOffset.x / Dimensions.get('window').width))
            }}
            snapToInterval={Dimensions.get('window').width}
          >
              <ScrollView 
              contentContainerStyle={{width:Dimensions.get('window').width}}>
                {summaries ? 
                summaries.length > 0 ?
                    <Summary teamHomeId={game.teamhome.api} summaries={summaries}></Summary>
                    : 
                    <View className='w-full h-40 ml-[-10] justify-center mt-14 items-center'>
                      <Text className='text-lg text-white font-bold font-dinLight'>Qual o teu prognostico para o Jogo ? </Text>
                      <TouchableOpacity 
                        onPress={()=>openModal()}
                        activeOpacity={0.7}
                        className='bg-white w-40 h-10 mt-3 justify-center   items-center rounded-full'
                      >
                      <Text className={`text-titleauth font-dinBold ${Platform.OS === 'ios' ? 'mt-3' : 'mt-0'} text-sm`}>ENVIAR</Text>
                    </TouchableOpacity>
                  </View>
                :
                  <View className='w-full h-40 ml-[-10] justify-center mt-14 items-center'>
                      <Text className='text-lg text-white font-bold font-dinLight'>Qual o teu prognostico para o Jogo ? </Text>
                      <TouchableOpacity 
                        onPress={()=>openModal()}
                        activeOpacity={0.7}
                        className='bg-white w-40 h-10 mt-3 justify-center   items-center rounded-full'
                      >
                      <Text className={`text-titleauth font-dinBold ${Platform.OS === 'ios' ? 'mt-3' : 'mt-0'} text-sm`}>ENVIAR</Text>
                    </TouchableOpacity>
                  </View>
                }  
              </ScrollView>
               <ScrollView  contentContainerStyle={{marginLeft:10,width:Dimensions.get('window').width,marginBottom:40}}>
                <Statistics homeTeamId={game.teamhome.api} statistics={statistics}></Statistics>
              </ScrollView>
               {standings  ? 
                  <Standings  standings={standings}></Standings>
                :
                <View className='w-full h-40 ml-[-10] justify-center mt-14 items-center'>
                    <Image source={require('../../../assets/icons/calendarcheck.png')}></Image>
                    <Text className='text-lg text-white font-bold font-dinLight'>Disponível no dia de jogo</Text>
                </View>
                }
                <ScrollView  contentContainerStyle={{marginLeft:10,width:Dimensions.get('window').width}}>
                {videos ? 
                  <Videos   videos={videos}></Videos>
                :
                <View className='w-full h-40 ml-[-10] justify-center mt-14 items-center'>
                      <Image source={require('../../../assets/icons/calendarcheck.png')}></Image>
                      <Text className='text-lg text-white font-bold font-dinLight'>Disponível no dia de jogo</Text>
                  </View>
                }
              </ScrollView>
              <ScrollView  contentContainerStyle={{marginLeft:10,width:Dimensions.get('window').width}}>
                {lineups ? 
                  lineups.length > 0 ? <ManOfTheMatch handleRefreshManofTheMatch={handleRefreshManofTheMatch} manOfTheMatch={manOfTheMatch} lineups={lineups} ></ManOfTheMatch>
               : <View className='w-full h-40 ml-[-10] justify-center mt-14 items-center'>
               <Image source={require('../../../assets/icons/calendarcheck.png')}></Image>
                 <Text className='text-lg text-white font-bold font-dinLight'>Disponível no dia de jogo</Text>
             </View> :
                <View className='w-full h-40 ml-[-10] justify-center mt-14 items-center'>
                      <Image source={require('../../../assets/icons/calendarcheck.png')}></Image>
                      <Text className='text-lg text-white font-bold font-dinLight'>Disponível no dia de jogo</Text>
                  </View>
                }
              </ScrollView>
          </ScrollView>
          
          </View>
  </Animated.View>
  <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}>
        <View className='flex h-full rounded-md bg-white_20 justify-end pt-40 items-center '>
          <View className='bg-bgauth  h-full rounded-t-xl  w-full round-md   shadow-xl'>
          <ViewShot ref={ref} options={{ fileName: "Your-File-Name", format: "jpg", quality: 0.9 }}>
            <View className='bg-bgauth  h-[390px] rounded-t-xl  w-full round-md  p-6 shadow-xl'>
              <Image
                className='  absolute h-[390px] w-[800px]'
                resizeMode='cover'
                source={require('../../../assets/opacebg.png')}  >
              </Image>
                <Animated.View 
                  style={[{backgroundColor:'#001B13'}]}
                  className='flex flex-1 h-[390px] absolute  w-[800px] opacity-80'>
                </Animated.View>
                <Image
                  className='items-center self-center mt-4 mb-3  w-20'
                  resizeMode='contain'
                  source={require('../../../assets/SCP360.png')}
                />
                <Text className='font-dinLight self-center text-3xl leading-[42px] text-white'>MATCH
                  <Text className='font-dinBold ext-3xl leading-[40px] text-white'>DAY</Text>
                </Text>
                <GamePrognosis 
                          isLast={true}
                          resultHome={game.scorehome}
                          resultaway={game.scoreaway}
                          jorney={game.journey}
                          timestamp={game.timestamp}
                          uriAwayLogo={game.teamaway.logo} 
                          awayteam={game.teamaway.name} 
                          uriLogo={game.teamhome.logo} 
                          hometeam={game.teamhome.name} 
                          competation={game.competition}
                />

            </View>
           </ViewShot>
            <TouchableOpacity 
                  onPress={()=>sharePrognosis()}
                className="flex-row w-full text-center justify-center mt-4  items-center "
              >
                    <Text className="text-titleauth text-lg   font-medium">
                  Partilhar Prognóstico
                    </Text>
              </TouchableOpacity>
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
  </SafeAreaView>
}

export default GameDetail;