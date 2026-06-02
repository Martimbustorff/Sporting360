import React from 'react';
import { useState, useEffect } from 'react';
import { View, Text, Image, Dimensions, StyleSheet } from 'react-native';
import { IStatisticsResponse } from '../../utils/graphql/query/statistics/IStatisticsResponse';
import { IPlayers } from '../../api/firebase/players';
import { ISummary } from '../../api/firebase/summary';

// import { Container } from './styles';
interface IPlayersProps {
  players: IPlayers[],
  summaries: ISummary[],
  homeTeamId: string
}

const formatName = (fullName: string = "") => {
  const [firstName, lastName] = fullName.split(' ');
  if(lastName !== undefined)
    return `${firstName.charAt(0)}.${lastName}`;
  return fullName;
};

const findPlayer = (playerId: string, players: IPlayers) => {
  const player = players.Players.find(p => p.playerId === playerId);
  console.log(playerId, player?.photo)
  return player;
};

const returnImage = (goals: Number, minutes: number, yellowcard: Number, redcard: Number) => {
  if (goals !== 0) {
    return require('../../assets/icons/goal.png')
  }
  else if (redcard !== 0) {
    return require('../../assets/icons/redcard.png')
  }
  else if (minutes < 90) {
    return require('../../assets/icons/sub.png')
  }
  else if (yellowcard !== 0) {
    return require('../../assets/icons/yellowcard.png')
  }
}

const Formation: React.FC<IPlayersProps> = ({ summaries, players, homeTeamId }) => {

  const [fontSize, setFontSize] = useState(11);

  const homePlayer = players?.filter((x) => x.teamId == homeTeamId);
  const awayPlayers = players?.filter((x) => x.teamId != homeTeamId);
  const homeSubsts = summaries?.filter((x) => x.team.api === homeTeamId && x.type === "subst")
  const awaySubsts = summaries?.filter((x) => x.team.api !== homeTeamId && x.type === "subst")
  // Extract grid data and calculate max rows and columns
  const gridData1 = homePlayer[0].Players?.map((x) => x.grid).filter((grid) => grid != "");
  const minutesData = homePlayer[0].Players?.map((x) => x.minutes).filter((minutes) => minutes != 0);
  console.log("homePlayer:::::::", gridData1)
  const [maxRow1, maxCol1] = gridData1 && gridData1.reduce(
    (acc, grid) => {
      const [row, col] = grid.split(':').map(Number);
      return [Math.max(acc[0], row), Math.max(acc[1], col)];
    },
    [0, 0]
  );
  const maxColsByRow1 = gridData1 && gridData1.reduce((acc, grid) => {
    const [row, col] = grid.split(':').map(Number);
    // Update the maximum column number for the current row
    acc[row] = Math.max(acc[row] || 0, col);
    return acc;
  }, {} as any);

  const maxMinutes = minutesData.reduce((max, player) => {
    return Math.max(max, player);
  }, 0);
  console.log("Minutes::::::::", maxMinutes)
  const gridData2 = awayPlayers[0].Players?.map((x) => x.grid).filter((grid) => grid != "");
  console.log("homePlayer:::::::", gridData2)
  const [maxRow2, maxCol2] = gridData2 && gridData2.reduce(
    (acc, grid) => {
      const [row, col] = grid.split(':').map(Number);
      return [Math.max(acc[0], row), Math.max(acc[1], col)];
    },
    [0, 0]
  );
  const maxColsByRow2 = gridData2 && gridData2.reduce((acc, grid) => {
    const [row, col] = grid.split(':').map(Number);
    // Update the maximum column number for the current row
    acc[row] = Math.max(acc[row] || 0, col);
    return acc;
  }, {} as any);

  useEffect(() => {
    const handleResize = () => {
      const screenWidth = Dimensions.get('window').width;
      // Adjust the font size based on screen width
      const newFontSize =Math.min(15, screenWidth / 40)
      setFontSize(newFontSize);
      console.log(newFontSize)
    };

    // Initial call to set the font size
    handleResize();
  }, []);

  // console.log("homePlayer:::::::", maxRow)
  // Calculate row height and column width dynamically
  const totalheight = (Dimensions.get('window').width - 40) * 1.6
  const containerHeight = totalheight / 2 - 10; // Total height for the team
  const rowHeight1 = containerHeight / maxRow1 - 1; // Height for each row
  const rowHeight2 = containerHeight / maxRow2 - 1; // Height for each row
  return <View className='flex w-full mt-4 h-full pr-8 mt-4' >
    <Image
      style={{ width: '100%', resizeMode: 'stretch', height: totalheight }}
      className='flex flex-1 top-0 absolute'
      source={require('../../assets/SoccerLine.png')}  >
    </Image>
    <View className='ml-[-64]'>
      {homePlayer[0].Players?.map((x) => {
        const IsSubstPlayer = homeSubsts.find(y => y.player.api === x.playerId)
        if (x.substitute == false) {
          if (!IsSubstPlayer) {
            const [row, col] = x.grid.split(':').map(Number);
            // Ensure padding, rowHeight, and maxRow are defined
            const top = (row - 1) * rowHeight1;
            const left = col * (Dimensions.get('window').width / (maxColsByRow1[row] + 1));
            const rate = parseFloat(x.rating)
            return (
              <View
                key={x.playerId}
                style={[styles.playerContainer, { top, left, width: 100 }]}
              >
                <View>
                  <Image
                    source={{ uri: x.photo }}
                    style={{ width: rowHeight1 / 5 * 3, height: rowHeight1 / 5 * 3, borderRadius: rowHeight1 / 10 * 3 }}
                  />
                  <View className='absolute bottom-0 object-contain left-[-13] flex-col'>
                    {x.cardsYellow !== 0 && x.cardsRed === 0 &&
                      <Image className='w-4 h-4' source={require('../../assets/icons/yellowcard.png')}></Image>}
                    {x.cardsRed !== 0 &&
                      <Image className='w-4 h-4' source={require('../../assets/icons/redcard.png')}></Image>}
                    {x.goals !== 0 &&
                      <Image className='w-4 h-4' source={require('../../assets/icons/goal.png')}></Image>}
                  </View>
                  {rate && <Text className='font-dinBold text-sm rounded-lg absolute' style={{ color: (rate >= 6.0 && rate < 7.0) ? 'blue' : 'white', backgroundColor: (rate >= 5.0 && rate < 6.0) ? 'red' : (rate >= 6.0 && rate < 7.0) ? 'yellow' : '#009913', bottom: 0, right: -15, width: 20, textAlign: 'center' }}> {rate} </Text>}
                </View>
                <Text className='font-dinBold bg-white rounded-lg' style={{ fontSize: Dimensions.get('window').width / 40 }}><Text style={{ color: 'gray' }}> {x.number} </Text>{formatName(x.name)} </Text>
              </View>
            );
          }
          else {
            const SubstPlayer = homePlayer[0].Players.find(player => player.playerId === IsSubstPlayer.playerSub.api)
            const [row, col] = x.grid.split(':').map(Number);
            // Ensure padding, rowHeight, and maxRow are defined
            const top = (row - 1) * rowHeight1;
            const left = col * (Dimensions.get('window').width / (maxColsByRow1[row] + 1));
            const rate = SubstPlayer ? parseFloat(SubstPlayer.rating) : 0
            return (
              <View
                key={SubstPlayer?.playerId}
                style={[styles.playerContainer, { top, left, width: 100 }]}
              >
                <View>
                  <Image
                    source={{ uri: SubstPlayer?.photo }}
                    style={{ width: rowHeight1 / 5 * 3, height: rowHeight1 / 5 * 3, borderRadius: rowHeight1 / 10 * 3 }}
                  />
                  <View className='absolute bottom-0 object-contain left-[-13] flex-col'>
                    {SubstPlayer?.cardsYellow !== 0 && SubstPlayer?.cardsRed === 0 &&
                      <Image className='w-4 h-4' source={require('../../assets/icons/yellowcard.png')}></Image>}
                    {SubstPlayer?.cardsRed !== 0 &&
                      <Image className='w-4 h-4' source={require('../../assets/icons/redcard.png')}></Image>}
                    {SubstPlayer?.goals !== 0 &&
                      <Image className='w-4 h-4' source={require('../../assets/icons/goal.png')}></Image>}
                      <Image className='w-4 h-4 ' source={require('../../assets/icons/sub.png')}></Image>
                  </View>
                  {rate && rate > 0 && <Text className='font-dinBold text-sm rounded-lg absolute' style={{ color: (rate >= 6.0 && rate < 7.0) ? 'blue' : 'white', backgroundColor: (rate >= 5.0 && rate < 6.0) ? 'red' : (rate >= 6.0 && rate < 7.0) ? 'yellow' : '#009913', bottom: 0, right: -15, width: 20, textAlign: 'center' }}> {rate} </Text>}
                </View>
                <Text className='font-dinBold bg-white rounded-lg' style={{ fontSize: Dimensions.get('window').width / 40 }}><Text style={{ color: 'gray' }}> {SubstPlayer?.number} </Text>{formatName(SubstPlayer?.name)} </Text>
              </View>
            );
          }
        }

      })}</View>
    <View className='ml-[-64]' style={{ marginTop: containerHeight + 30 }}>
      {awayPlayers[0].Players?.map((x) => {

        const IsSubstPlayer = awaySubsts.find(y => y.player.api === x.playerId)
        if (x.substitute == false) {
          if (!IsSubstPlayer) {
            const [row, col] = x.grid.split(':').map(Number);
            // Ensure padding, rowHeight, and maxRow are defined
            const top = (maxRow2 - row) * rowHeight2;
            const left = col * (Dimensions.get('window').width / (maxColsByRow2[row] + 1));
            const rate = parseFloat(x.rating)
            return (
              <View
                key={x.playerId}
                style={[styles.playerContainer, { top, left, width: 100 }]}
              >
                <View>
                  <Image
                    source={{ uri: x.photo }}
                    style={{ width: rowHeight2 / 5 * 3, height: rowHeight2 / 5 * 3, borderRadius: rowHeight2 / 10 * 3 }}
                  />

                  <View className='absolute bottom-0 object-contain left-[-13] flex-col'>
                    {x.cardsYellow !== 0 && x.cardsRed === 0 &&
                      <Image className='w-4 h-4' source={require('../../assets/icons/yellowcard.png')}></Image>}
                    {x.cardsRed !== 0 &&
                      <Image className='w-4 h-4' source={require('../../assets/icons/redcard.png')}></Image>}
                    {x.goals !== 0 &&
                      <Image className='w-4 h-4' source={require('../../assets/icons/goal.png')}></Image>}
                  </View>
                  {rate && rate > 0 && <Text className='font-dinBold text-sm rounded-lg absolute' style={{ color: (rate >= 6.0 && rate < 7.0) ? 'blue' : 'white', backgroundColor: (rate >= 5.0 && rate < 6.0) ? 'red' : (rate >= 6.0 && rate < 7.0) ? 'yellow' : '#009913', bottom: 0, right: -15, width: 20, textAlign: 'center' }}> {rate} </Text>}
                </View>
                <Text className='font-dinBold bg-white rounded-lg' style={{ fontSize: Dimensions.get('window').width / 40 }}><Text style={{ color: 'gray' }}> {x.number} </Text>{formatName(x.name)} </Text>
              </View>
            );
          }
          else {
            const SubstPlayer = awayPlayers[0].Players.find(player => player.playerId === IsSubstPlayer.playerSub.api)
            const [row, col] = x.grid.split(':').map(Number);
            // Ensure padding, rowHeight, and maxRow are defined
            const top = (maxRow2 - row) * rowHeight2;
            const left = col * (Dimensions.get('window').width / (maxColsByRow2[row] + 1));
            const rate = SubstPlayer ? parseFloat(SubstPlayer.rating) : 0
            return (
              <View
                key={SubstPlayer?.playerId}
                style={[styles.playerContainer, { top, left, width: 100 }]}
              >
                <View>
                  <Image
                    source={{ uri: SubstPlayer?.photo }}
                    style={{ width: rowHeight2 / 5 * 3, height: rowHeight2 / 5 * 3, borderRadius: rowHeight2 / 10 * 3 }}
                  />

                  <View className='absolute bottom-0 object-contain left-[-13] flex-col'>
                    {SubstPlayer?.cardsYellow !== 0 && SubstPlayer?.cardsRed === 0 &&
                      <Image className='w-4 h-4' source={require('../../assets/icons/yellowcard.png')}></Image>}
                    {SubstPlayer?.cardsRed !== 0 &&
                      <Image className='w-4 h-4' source={require('../../assets/icons/redcard.png')}></Image>}
                    {SubstPlayer?.goals !== 0 &&
                      <Image className='w-4 h-4' source={require('../../assets/icons/goal.png')}></Image>}
                      <Image className='w-4 h-4 ' source={require('../../assets/icons/sub.png')}></Image>
                  </View>
                  {rate && rate > 0 && <Text className='font-dinBold text-sm rounded-lg absolute' style={{ color: (rate >= 6.0 && rate < 7.0) ? 'blue' : 'white', backgroundColor: (rate >= 5.0 && rate < 6.0) ? 'red' : (rate >= 6.0 && rate < 7.0) ? 'yellow' : '#009913', bottom: 0, right: -15, width: 20, textAlign: 'center' }}> {rate} </Text>}
                </View>
                <Text className='font-dinBold bg-white rounded-lg' style={{ fontSize: Dimensions.get('window').width / 40 }}><Text style={{ color: 'gray' }}> {SubstPlayer?.number} </Text>{formatName(SubstPlayer?.name)} </Text>
              </View>
            );
          }
        }
      })}</View>
      <View>
        <Text className='font-dinBold text-2xl text-white text-bold text-center' style={{ marginTop: containerHeight + 30, marginBottom: 30}}> Substitute Players </Text>
      </View>
    <View style={{ marginBottom: 30, flexDirection: 'row', justifyContent: 'space-between' }}>
      <View style={{ flex: 1 }} className='flex-col'>
        {homeSubsts?.sort((a, b) => Number(a.time) - Number(b.time)).map(x => {
          const rate = findPlayer(x.player.api, homePlayer[0])?.rating ? parseFloat(findPlayer(x.player.api, homePlayer[0])?.rating ?? "0") : 0
          return (
            <View key={x.player.api} className='w-auto mt-4 mb-2 flex-row items-center justify-start gap-2'>
              <Image className='w-10 h-10 rounded-full object-contain' source={{ uri: findPlayer(x.player.api, homePlayer[0])?.photo }} />
              <View className='flex-col gap-1'>
                <View className='flex-row gap-2'>
                  {rate && rate > 0 && <Text className='font-dinBold text-sm rounded-sm' style={{ color: (rate >= 6.0 && rate < 7.0) ? 'blue' : 'white', backgroundColor: (rate >= 5.0 && rate < 6.0) ? 'red' : (rate >= 6.0 && rate < 7.0) ? 'yellow' : '#009913', width: 20, textAlign: 'center' }}> {rate} </Text>}
                  <Text className='text-white font-Poppins text-md' style={{ fontWeight: '900', textAlign: 'center', textAlignVertical: 'center', fontSize: Dimensions.get('window').width / 35 }}>
                    {x.player.name}
                  </Text>
                </View>
                <View className='flex-row gap-2'>
                  <Text className='text-white text-sm' style={{ fontWeight: '400', fontSize: Dimensions.get('window').width / 35 }}>
                    ({x.playerSub.name})
                  </Text>
                  <Text className='text-white font-Poppins text-sm' style={{ fontWeight: '400', fontSize: Dimensions.get('window').width / 35 }}> {x.time}´</Text>
                </View>
              </View>
            </View>)
        })}
      </View>
      <View style={{ flex: 1 }} className='flex-col items-end'>
        {awaySubsts?.sort((a, b) => Number(a.time) - Number(b.time)).map(x => {
          const rate = findPlayer(x.player.api, awayPlayers[0])?.rating ? parseFloat(findPlayer(x.player.api, awayPlayers[0])?.rating ?? "0") : 0
          return (
            <View key={x.player.api} className='w-auto mt-4 mb-2 flex-row items-center justify-end'>
              <View className='flex-col gap-1'>
                <View className='flex-row gap-2  justify-end '>
                  <Text className='text-white font-Poppins text-md' style={{ fontWeight: '900', textAlign: 'center', textAlignVertical: 'center', fontSize: Dimensions.get('window').width / 35 }}>
                    {x.player.name}
                  </Text>
                  {rate && rate > 0 && <Text className='font-dinBold text-sm rounded-sm mr-2' style={{ color: (rate >= 6.0 && rate < 7.0) ? 'blue' : 'white', backgroundColor: (rate >= 5.0 && rate < 6.0) ? 'red' : (rate >= 6.0 && rate < 7.0) ? 'yellow' : '#009913', width: 20, textAlign: 'center' }}> {rate} </Text>}
                </View>
                <View className='flex-row gap-2 justify-end'>
                  <Text className='text-white font-Poppins text-sm' style={{ fontWeight: '400', fontSize: Dimensions.get('window').width / 35 }}> {x.time}´</Text>
                  <Text className='text-white text-sm mr-2' style={{ fontWeight: '400', fontSize: Dimensions.get('window').width / 35 }}>({x.playerSub.name})</Text>
                </View>
              </View>
              <Image className='w-10 h-10 rounded-full object-contain' source={{ uri: findPlayer(x.player.api, awayPlayers[0])?.photo }} />
            </View>)
        })}
      </View>
    </View>
  </View>
}


const styles = StyleSheet.create({
  playerContainer: {
    position: 'absolute',
    alignItems: 'center',
  },
  playerName: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 5,
  },
  playerRating: {
    fontSize: 10,
    color: 'gray',
  },
  playerStats: {
    fontSize: 10,
    color: 'gray',
  },
});
export default Formation