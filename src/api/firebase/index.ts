import firebase from '@react-native-firebase/app';
import '@react-native-firebase/auth';
import { Platform } from 'react-native';
import '@react-native-firebase/firestore';

const iOSConfig = {
    clientId: "394641993263-84tree10asc01anqldkhog14sbqq1k7b.apps.googleusercontent.com",
    apiKey: "AIzaSyBYFyWVQr0RxZkNFIf-lphRj9hw5rkYJ0M",
    authDomain: "com.scp360",
    databaseURL: "https://scp360-37a74-default-rtdb.firebaseio.com",
    projectId: "scp360-37a74",
    storageBucket: "scp360-37a74.firebasestorage.app",
    messagingSenderId: "394641993263",
    appId: "1:394641993263:ios:5208e1caf7f30d3c4b20da"
};

const androidConfig = {
    clientId: "394641993263-m82d9jj7m2do7204davvqo5k1f09epoh.apps.googleusercontent.com",
    apiKey: "AIzaSyD4vQ8cEg3mcB7worVkOIPsjdYDBzKVQxM",
    authDomain: "com.scp360",
    databaseURL: "https://scp360-37a74-default-rtdb.firebaseio.com",
    projectId: "scp360-37a74",
    storageBucket: "scp360-37a74.firebasestorage.app",
    messagingSenderId: "394641993263",
    appId: "1:394641993263:android:2ac911930d9666c44b20da"
};

const init = async () => {
    let app;

    console.log("😁😁😁😁 Initializing Firebase project");
    if (firebase.apps.length === 0) {
        console.log("Initilizaing...")
        app = await firebase.initializeApp(Platform.OS === 'ios' ? iOSConfig : androidConfig)
        // firestore().settings({ experimentalForceLongPolling: true });
    } else {
        app = firebase.app();
    }
    
    const db = firebase.firestore();
    const auth = firebase.auth();

    return app;
}


export default init;