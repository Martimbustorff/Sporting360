// GameboxCard.js
import React from "react";
import { View, Text, TouchableOpacity, Image } from "react-native";
import QRCode from 'react-native-qrcode-svg';
import { decryptGameBox } from "../../../services/decryptGameBox";

const GameboxCard = ({ gamebox,user ,navigation}) => {
  if(gamebox === null) {
    return (
      <Text className="font-dinBold mt-2 text-black text-lg">A Carregar informação</Text>
    )
  }
  return (
   <View className="flex flex-col">
     <View className="w-80 mr-2 justify-center mb-4 mt-4 items-center">
      <QRCode
        value={decryptGameBox(gamebox.gameboxNumber, user.uuid)}
        size={180}
        color={'#003625'}
        logoBackgroundColor='#000'
      />
      <Text className="font-dinBold mt-2 text-black text-lg">{gamebox.gameboxName}</Text>
      <Text className="font-dinLight text-black text-lg">{decryptGameBox(gamebox.gameboxNumber, user.uuid)}</Text>
      <View className="bg-whiteHomeGamebox w-full rounded-lg flex flex-row justify-between h-20 mt-4">
        <View className="flex flex-col justify-center items-center w-20">
          <Text className="font-dinBold text-black opacity-50 text-sm">PORTA</Text>
          <Text className="font-dinRegular text-black text-lg">{gamebox.gameboxPort ? gamebox.gameboxPort : '---'}</Text>
        </View>
        <View className="flex flex-col justify-center items-center w-20">
          <Text className="font-dinBold text-black opacity-50 text-sm">SECTOR</Text>
          <Text className="font-dinRegular text-black text-lg">{gamebox.gameboxSector ? gamebox.gameboxSector : '---'}</Text>
        </View>
        <View className="flex flex-col justify-center items-center w-20">
          <Text className="font-dinBold text-black opacity-50 text-sm">FILA</Text>
          <Text className="font-dinRegular text-black text-lg">{gamebox.gameboxLine ? gamebox.gameboxLine : '---'}</Text>
        </View>
        <View className="flex flex-col justify-center items-center w-20">
          <Text className="font-dinBold text-black opacity-50 text-sm">LUGAR</Text>
          <Text className="font-dinRegular text-black text-lg">{gamebox.gameboxSeat ? gamebox.gameboxSeat : '---'}</Text>
        </View>
      </View>
      <TouchableOpacity onPress={() => navigation.navigate('GameboxList')}>
        <Text className="text-black text-center text-sm mb-4 mt-2 font-dinRegular">
          Podes editar a GameBox nas
          <Text className="text-titleauth text-sm font-dinBold">{''} definições</Text>
        </Text>
      </TouchableOpacity>
    </View>
  </View>

  );
};

export default GameboxCard;
