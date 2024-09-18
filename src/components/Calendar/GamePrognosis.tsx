import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { View,Image,Text,ScrollView, Dimensions, TouchableOpacity, Linking, Platform, StatusBar, TextInput, Keyboard, TouchableWithoutFeedback } from 'react-native';
import ViewShot from "react-native-view-shot";

interface IGame {
  competation: string;
  uriLogo:string,
  hometeam:string,
  uriAwayLogo:string,
  awayteam:string,
  jorney:string,
  resultHome?:string,
  resultaway?:string,
  timestamp:string,
  isLast?:boolean,
}
const GamePrognosis = ({competation,hometeam,uriLogo,jorney,awayteam,uriAwayLogo,timestamp,isLast,resultHome,resultaway}:IGame) => {
  function formatDate() {
    const date = new Date(Number(timestamp) * 1000);
    const dayOfWeek = date.getDay();
    const dayNames = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    const dayOfMonth = date.getDate();
    const monthNames = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
    const monthName = monthNames[date.getMonth()];
    const formattedDate = `${dayOfMonth} ${monthName} ${isLast ? formatHour() : ""}` ;
    return formattedDate;
  }

  function formatHour() {
    const date = new Date(Number(timestamp) * 1000);
   
    const formattedDate = `${date.getHours()}:${date.getMinutes()}`;
    return formattedDate;
  }
  
return  <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
   <View className='w-full pb-4     mt-3 h-60 '>
      <Text className='mb-3 text-white font-bold self-center'>
        {competation}
      </Text>
    <View className='w-full flex-row mb-2 justify-between'>
      <View className='w-1/3'>
        <View style={{backgroundColor:'#00835B'}} className='  left-0 justify-center mt-2  items-center rounded-full h-5 w-9'>
                <Text className={`font-dinBold  text-xs  text-white ${Platform.OS === 'ios' && ' h-full mt-[15]'}`}>J{jorney.trim()}</Text>
        </View> 
      </View>
    
      <View className='w-1/3  mb-3 mt-3 justify-center items-center'>
        <Text className={`font-dinLight  text-sm  text-white `}>
                  {formatDate()}
        </Text>
      </View>
      <View className='w-1/3'>
      </View>

    </View>
   
    <View className='w-full flex-row  mt-[-10]  mb-0 justify-between '>
        <View className='flex justify-center flex-col items-center w-1/3  gap-2'>
            <Image className='w-16  h-16 ' source={{uri:uriLogo}}  />
            <Text className='font-dinLight 
                w-16
                text-center h-15 flex-wrap text-xs pt-1 mt-2 mb-2 text-white'>
              {hometeam}
            </Text>
        </View>
        <View className='flex flex-col w-1/3  items-center gap-2'>
          <View className=' justify-center mb-[-8]  items-center'>
           
              <View className='w-22 flex-row   justify-between'>
                  <TextInput 
                  keyboardType='number-pad'
                  className='bg-white w-11 
                  mr-2
                  ml-2
                    font-bold font-dinBold  text-3xl  text-center leading-[15px] h-20
                     rounded-md '>
                  </TextInput>
                  <TextInput 
                  onChangeText={(text)=>text ? Keyboard.dismiss() : null}
                  keyboardType='number-pad'
                  className='bg-white ml-2 w-11   
                    font-bold font-dinBold  text-3xl  text-center leading-[15px] h-20
                  rounded-md '
                  />
              </View>
          </View>
        </View>
        <View className='flex justify-center items-center w-1/3 flex-col  gap-2'>
           <Image className='w-16  h-16 ' resizeMode='contain' source={{uri:uriAwayLogo}}  />
               <Text className='font-dinLight 
                w-20
                text-center h-15 flex-wrap text-xs pt-1 mt-2 mb-2 text-white'>
              {awayteam}
            </Text>

        </View>
    </View>
    <Text className='font-dinBold self-center mt-[-15]  text-sm leading-[18px] text-white'>
             #JogoAJogoLadoALado
    </Text>
     <Text className='font-dinLight self-center  text-sm leading-[20px] text-white'>
        Partilha o teu prognóstico
     </Text>
</View>  
</TouchableWithoutFeedback>
}

export default GamePrognosis;