// HomeMenuItem.js
import React from "react";
import { View, Text, TouchableOpacity, Image, Platform, Linking } from "react-native";

const HomeMenuItem = ({ item, navigation,index,Urls }) => {
  return (
    <TouchableOpacity
    activeOpacity={0.7}
    onPress={async () => {
      if (item.url) {
        if (Platform.OS === 'ios') {
          await Linking.openURL(item.url);
        } else {
          navigation.navigate('Browser', {
            index: index
          });
        }
      } else {
        if (item.page) {
          navigation.navigate(String(item.page));
        }
      }
    }}
    className='pl-8 pr-8 pb-2 mb-4 '>
       <View className={`flex flex-row ${ (index + 1) === Urls.length ? 'border-none' : 'border-b' } border-b-white_gray pb-3  gap-2 justify-between items-center`}>
        <View className='flex flex-row  justify-center items-center'>
          <Image resizeMode="contain"  className="h-8 w-6 mr-2 object-contain" source={item.image} />
          <Text className={`font-dinBold ${Platform.OS === 'ios' ? 'h-6 mt-4' : 'mt-0'} text-white text-sm`}>{item.title}</Text>
        </View>
        <Image className="top-1"  source={require('../../assets/arrow.png')} />
      </View>
  </TouchableOpacity>
  );
};

export default HomeMenuItem;
