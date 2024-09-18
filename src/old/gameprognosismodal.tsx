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
        source={require('../../assets/opacebg.png')}  >
      </Image>
        <Animated.View 
          style={[{backgroundColor:'#001B13'}]}
          className='flex flex-1 h-[390px] absolute  w-[800px] opacity-80'>
        </Animated.View>
        <Image
          className='items-center self-center mt-4 mb-3  w-20'
          resizeMode='contain'
          source={require('../../assets/SCP360.png')}
        />
        <Text className='font-dinLight self-center text-3xl leading-[42px] text-white'>MATCH
          <Text className='font-dinBold ext-3xl leading-[30px] text-white'>DAY</Text>
        </Text>
        <Text className='font-dinLight self-center text-base leading-[24px] text-white'>
          Meu
           Prognóstico
        </Text>
        <GamePrognosis 
                  isLast={true}
                  resultHome={nextGame?.node.scorehome}
                  resultaway={nextGame?.node.scoreaway}
                  jorney={nextGame?.node.journey}
                  timestamp={nextGame?.node.timestamp}
                  uriAwayLogo={teams.data.teamCollection.edges.find(team=>team.node.id === nextGame?.node?.teamAway).node?.logo} 
                  awayteam={teams.data.teamCollection.edges.find(team=>team.node.id === nextGame?.node?.teamAway).node?.name} 
                  uriLogo={teams.data.teamCollection.edges.find(team=>team.node.id === nextGame?.node?.teamHome).node?.logo} 
                  hometeam={teams.data.teamCollection.edges.find(team=>team.node.id === nextGame?.node?.teamHome).node?.name} 
                  competation={nextGame?.node.competation}
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
