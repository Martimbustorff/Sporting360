import { createNativeStackNavigator } from '@react-navigation/native-stack';
import Intro from '../screens/onboarding';
import Home from '../screens/app/home';

import Register from '../screens/auth/register';
import Login from '../screens/auth/login';
import Reset from '../screens/auth/reset';
import AuthHome from '../screens/auth';
import Browser from '../screens/app/Browser';
import Terms from '../screens/app/terms';
import Index from '../screens/auth';



const Stack = createNativeStackNavigator();

export function AuthRoutes() {
  return (
    <Stack.Navigator 
      screenOptions={{
        headerShown:false
      }}
     >
    <Stack.Screen name='Index' component={Index} options={{
         title: 'Faça login'
      }}/>
     <Stack.Screen name='Login' component={Login} options={{
         title: 'Faça login'
      }}/>

      <Stack.Screen name="Terms" component={Terms} />

      <Stack.Screen name='Register' component={Register} options={{
        title: 'Criar conta'
      }}/>

      <Stack.Screen name='Reset' component={Reset} options={{
        title: 'Recuperar conta'
      }}/>

    </Stack.Navigator>
  );
}