import React, { useEffect, useState } from 'react';
import firebaseApp from "./src/api/firebase/index";
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View , ActivityIndicator } from 'react-native';
import 'react-native-gesture-handler';
import { useFonts } from 'expo-font';
import { NavigationContainer } from '@react-navigation/native';
import { AuthRoutes } from './src/routes/auth.routes';
import FlashMessage from "react-native-flash-message";
import { useAuthStore } from './src/store/auth.store';
import Routes from './src/routes/index.routes';
// import { Root as PopupRootProvider } from 'react-native-popup-confirm-toast';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ApolloClient, InMemoryCache, ApolloProvider, HttpLink, ApolloLink } from '@apollo/client';
import { OneSignal } from 'react-native-onesignal';
import * as Linking from 'expo-linking';
import './gesture-handler';
const prefix = Linking.createURL('/');
import "./global.css";

// firebase.initializeApp({
//   clientId: "394641993263-m82d9jj7m2do7204davvqo5k1f09epoh.apps.googleusercontent.com",
//   apiKey: "AIzaSyD4vQ8cEg3mcB7worVkOIPsjdYDBzKVQxM",
//   authDomain: "com.scp360",
//   databaseURL: "https://scp360-37a74-default-rtdb.firebaseio.com",
//   projectId: "scp360-37a74",
//   storageBucket: "scp360-37a74.appspot.com",
//   messagingSenderId: "394641993263",
//   appId: "1:394641993263:android:2ac911930d9666c44b20da"
// });
//firebaseApp();
const httpLink = new HttpLink({
  uri: 'http://164.92.254.4:1337/graphql', // Replace with your GraphQL server URL
});
OneSignal.initialize('f5ea4bca-d5e4-4d50-a02f-85ca4c5bd12f');
OneSignal.Notifications.requestPermission(true);
// Create a middleware link to set the bearer token in the headers
const authLink = new ApolloLink((operation, forward) => {
  // Retrieve the bearer token from wherever you have it stored
  // Set the authorization header with the token
  operation.setContext({
    headers: {
      Authorization:
        'Bearer 78ad69f0b97f7de8c47c605d8eb44b4ff8d8de2a06442ea17dfe79e4eee0746d1813f405e2250e6898025ca4abeabf1645d93ba9556ff2ffacee45bd02b448c6e7a497e7ce1e812a0369c73a35c2056f2ad565b8813a7af96201c20bc9045f8882d62195c310e178b4c66ab181da5e836fd7c0b5a108ea0bac74a28d15a99ba3',
    },
  });

  return forward(operation);
});


const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache()
});

export default function App() {

  const [fontsLoaded] = useFonts({
    'DinBold': require('./src/assets/fonts/DIN-Bold.ttf'),
    'DinLight': require('./src/assets/fonts/DIN-Light.ttf'),
    'DinRegular': require('./src/assets/fonts/DIN-Medium.ttf'),
    'DinMedium': require('./src/assets/fonts/DIN-Regular.ttf'),
    'DinCondensed': require('./src/assets/fonts/DINCondensed-Regular.ttf'),
    'DinCondensedLight': require('./src/assets/fonts/DINCondensed-Light.ttf'),
    'Poppins': require('./src/assets/fonts/Poppins-Regular.ttf'),
    'PoppinsMedium': require('./src/assets/fonts/Poppins-Medium.ttf'),
    'PoppinsBold': require('./src/assets/fonts/Poppins-Bold.ttf'),
  });

  // useEffect(() => {
  //    initFirebaseApp();
  // }, []);

  // const initFirebaseApp = async () => {
  //   await firebaseApp();
  // }

  // const linking = {
  //   prefixes: [prefix],
  // };

  const [isFirebaseInitialized, setFirebaseInitialized] = useState(false);

  useEffect(() => {
    const initFirebaseApp = async () => {
      try {
        console.log("Initializing Firebase...");
        await firebaseApp();
        setFirebaseInitialized(true); // Set state when Firebase is initialized
        console.log("Firebase initialized successfully");
      } catch (error) {
        console.error("Error initializing Firebase:", error);
      }
    };

    initFirebaseApp();
  }, []);

  const linking = {
    prefixes: [prefix],
  };

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ApolloProvider client={client}>
      <GestureHandlerRootView className='bg-bgauth flex flex-1'>
        <View className='bg-bgauth flex flex-1'>
            <NavigationContainer linking={linking}>
              <Routes></Routes>
              <StatusBar translucent style={'light'} />
              <FlashMessage position="top" />
            </NavigationContainer>
        </View>
      </GestureHandlerRootView>
    </ApolloProvider>
  );
}
const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});