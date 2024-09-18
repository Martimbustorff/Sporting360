// HomeHeader.js
import React from "react";
import { View, Text, TouchableOpacity, Image, Platform } from "react-native";

const HomeHeader = ({ navigation, user }) => {
  
  const validateInfoDate = (dateStr) => {
    const pattern = /^\d{2}\/\d{4}$/; // Regular expression for 00/0000 format
    if (pattern.test(dateStr)) {
      return true
    } else {
      return false
    }
  }

  return (
    <View>
       <View className=' flex-row mb-14 h-10 justify-between items-center w-[100%]'>
              <View className="h-full items-center justify-center pt-2">
                <Text className={`font-dinBold ${Platform.OS === 'ios'? 'leading-10' : 'h-10' } pt-1 text-white text-3xl`}>S360</Text>
              </View>
              <TouchableOpacity  onPress={()=>navigation.navigate('DefinitionsMenu')} activeOpacity={0.7}>
                <Image className='object-contain ' source={require('../../assets/settings.png')}></Image>
              </TouchableOpacity>
      </View>
      <TouchableOpacity onPress={()=>!user ? navigation.navigate('DefinitionsMenu') : null}>
        <Text className='font-dinBold text-white mb-6 text-xl'>{user ? user.name.toUpperCase() : 'Registar para adicionar nome'}</Text>
        <Text className="font-dinBold text-white opacity-50 text-sm">SÓCIO DESDE</Text>
        <Text className="font-dinBold text-white text-lg">
          {user ? user.partnerNumber ? validateInfoDate(user.partnerNumber) ? user.partnerNumber : 'SEM DATA INÍCIO SÓCIO' : 'SEM DATA INÍCIO SÓCIO' : 'Registar para data de inicio de Sócio'}
        </Text>
      </TouchableOpacity>
    </View>
  );
};

export default HomeHeader;
