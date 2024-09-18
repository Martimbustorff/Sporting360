import { createStackNavigator } from '@react-navigation/stack';
import Intro from '../screens/onboarding';
import Home from '../screens/app/home';
import React from 'react';
import Register from '../screens/auth/register';
import Login from '../screens/auth/login';
import Reset from '../screens/auth/reset';
import AuthHome from '../screens/auth';
import Browser from '../screens/app/Browser';
import Terms from '../screens/app/terms';
import Definitions from '../screens/app/definitions';
import Calendar from '../screens/app/calendar';
import Index from '../screens/auth';
import { useAuthStore } from '../store/auth.store';
import { useNavigation } from '@react-navigation/native';
import { MMKV } from 'react-native-mmkv';
import { Stadium } from '../screens/app/stadium';
import clubsites from '../screens/app/clubsites';
import DefinitionsMenu from '../screens/app/definitionsmenu';
import Gamebox from '../screens/app/gamebox/gamebox';
import GameboxMangement from '../screens/app/gamebox/gamexmanagement';
import GameboxList from '../screens/app/gamebox/gameboxList';
import GameboxMangementDefault from '../screens/app/gamebox/gamexmanagementDefault';
import GameDetail from '../screens/app/game/details';


const Stack = createStackNavigator();


export function AppRoutes() {
  const user = useAuthStore((state) => state.user)
  const navigation = useNavigation()
  const storage = new MMKV()
  const enterInApp = storage.getString('user.enterInApp')
  return (
    <Stack.Navigator 
      screenOptions={{
        headerShown:false,
        animationEnabled:false,
      }}
     >
      <Stack.Screen name='Index' component={enterInApp ? Home :Index} options={{
         title: 'Faça login'
      }}/>

      <Stack.Screen name="Home" component={Home}     options={{
          animationEnabled: false,
        }} />
    
     <Stack.Screen name='Login' component={Login} options={{
         title: 'Faça login'
      }}/>


      <Stack.Screen name='Register' component={Register} options={{
        title: 'Criar conta'
      }}/>

      <Stack.Screen name='Reset' component={Reset} options={{
        title: 'Recuperar conta'
      }}/>

      <Stack.Screen name="Browser" component={Browser}     options={{
          animationEnabled: false,
        }} />
      <Stack.Screen name="Terms" component={Terms}     options={{
          animationEnabled: false,
        }} />



      <Stack.Screen name="Stadium" component={Stadium}     options={{
          animationEnabled: false,
        }} />
      <Stack.Screen name="Definitions" component={!user ? Login : Definitions}     options={{
          animationEnabled: false,
        }} />
      <Stack.Screen name="Gamebox" component={!user ? Login : Gamebox}      options={{
          animationEnabled: false,
        }}/>

      <Stack.Screen name="GameboxMangementDefault" component={!user ? Login : GameboxMangementDefault}      options={{
          animationEnabled: false,
        }}/>


        <Stack.Screen name="Calendar" component={Calendar}      options={{
          animationEnabled: false,
        }}/>
        
        <Stack.Screen name="Clubsites" component={clubsites}      options={{
          animationEnabled: false,
        }}/>

        <Stack.Screen name="DefinitionsMenu" component={!user ? Login : DefinitionsMenu}    options={{
          animationEnabled: false,
        }}/>

       <Stack.Screen name="GameboxMangement" component={!user ? Login : GameboxMangement}      options={{
          animationEnabled: false,
        }}/>

      <Stack.Screen name="GameboxList" component={!user ? Login : GameboxList}      options={{
          animationEnabled: false,
        }}/>
 <Stack.Screen name="GameDetail" component={GameDetail}      options={{
          animationEnabled: false,
        }}/>


    </Stack.Navigator>
  );
}