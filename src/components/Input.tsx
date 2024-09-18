import React, { useEffect, useState } from "react";
import { View,Image,Text,ScrollView, Dimensions, TouchableOpacity, Linking, TextInput, TextInputProps, Platform } from 'react-native';
import Animated, { FadeInUp, interpolateColor, useAnimatedStyle, useSharedValue, withSpring, withTiming }  from 'react-native-reanimated';
import { MaskedTextInput} from "react-native-mask-text";
type IInput =  TextInputProps & {
  title: string;
  defaultValue: string;
  maskInput:boolean;
  mask:string;
  handleGetValue: (value: string) => void;
}
const Input = ({title,handleGetValue,defaultValue,mask,maskInput,...rest}:IInput) => {
  const [focus, setFocus] = useState(false);
  const [active, setActive] = useState(false);
  const [value, setValue] = useState(defaultValue);


  const BootomValue = useSharedValue(10);
  const opacityValue = useSharedValue(1);

  const textStyle = useAnimatedStyle(() => {
    return {
      opacity:opacityValue.value,
      bottom:BootomValue.value
    };
  });
  
   useEffect(()=>{
    handleGetValue(value)
   },[value])

  useEffect(()=> {
    if(focus || defaultValue){
      BootomValue.value = withSpring(24)
      opacityValue.value = withSpring(0.5)
    }else{
      BootomValue.value = withSpring(10)
      opacityValue.value = withSpring(1)
    }
  },[focus,defaultValue])
  
  return   <View className="w-full h-10 mb-8">
  <Animated.Text 
   style={textStyle}
   className={`font-dinBold ${focus ? 'text-xs':'text-sm'} ${Platform.OS == 'ios' ? 'leading-5 ' : 'leading-7' } bottom-3 absolute text-white`}>{title}</Animated.Text>
      {maskInput ? 
          <MaskedTextInput
          mask={mask}
          onChangeText={(text, rawText) => {
            setValue(text);
          }}
          placeholder={focus ? "Ex: 09/1987" :""}
          placeholderTextColor={'#8a8a8a9a'}
          onBlur={()=>{
            if(!value){
              setFocus(!focus)
            }
            setActive(false)
          }}
          onFocus={()=>{
            setFocus(true)
            setActive(true)
          }}
          value={value}
          className={`w-full h-full text-white font-dinBold border-b ${Platform.OS == 'ios' ? 'leading-3' : 'leading-none' }  
          ${active ? 'border-b-titleauth':'border-b-white'} `} 
          keyboardType="numeric"
        />
      : 
      <TextInput 
      {...rest}
      value={value}
      onChangeText={setValue}
      onBlur={()=>{
        if(!value){
          setFocus(!focus)
        }
        setActive(false)
      }}
      onFocus={()=>{
        setFocus(true)
        setActive(true)
      }}
      className={`w-full h-full text-white font-dinBold border-b ${Platform.OS == 'ios' ? 'leading-3' : 'leading-none' }  
       ${active ? 'border-b-titleauth':'border-b-white'} `} 
      />
      }
  
</View>

}

export default Input;