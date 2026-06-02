import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Dimensions,
  StyleSheet,
  Image,
  Modal,
  TouchableOpacity,
} from "react-native";
import { IVideos } from "../../api/firebase/videos";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { useNavigation } from "@react-navigation/native";
import * as ScreenOrientation from "expo-screen-orientation";

const VideoShow = ({ route }) => {
  const navigation = useNavigation();
  const { selectedVideoLink } = route.params;
  const embedHtml = `
    <html>
      <head>
        <title>Video Player</title>
        <style>
        /* Ensure the body takes up the full screen and the background is black */
        body {
            margin: 0;
            padding: 0;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh; /* Full viewport height */
            background-color: black; /* Black background for the rest of the screen */
        }

        /* Ensure the iframe maintains aspect ratio */
        .video-container {
            position: relative;
            width: 100%; /* Adjust this value to set the video width as desired */
            padding-bottom: 56.25%; /* 16:9 aspect ratio (height/width * 100) */
            height: 0; /* Set height to 0 so that padding-bottom determines the height */
            background-color: black;
            overflow: hidden;
        }

        /* Ensure iframe fills the container and maintains the aspect ratio */
        .video-container iframe {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        </style>
      </head>
      <body>
        
        <div class="video-container">
        ${selectedVideoLink}
        </div>
      </body>
    </html>
  `;

  // React.useEffect(() => {
  //   // Lock the orientation to landscape
  //   // ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

  //   // // Listen for orientation changes to re-adjust layout when changing back to portrait
  //   // const orientationChangeListener = ScreenOrientation.addOrientationChangeListener(({ orientationInfo }) => {
  //   //   if (orientationInfo.orientation === ScreenOrientation.Orientation.PORTRAIT_UP) {
  //   //     // Unlock orientation and reset layout when going back to portrait
  //   //     ScreenOrientation.unlockAsync();
  //   //   }
  //   // });

  //   // Clean up the listener when the component is unmounted
  //   return () => {
  //     ScreenOrientation.removeOrientationChangeListener(orientationChangeListener);
  //     ScreenOrientation.unlockAsync(); // Unlock orientation on cleanup
  //   };
  // }, []);

  return (
    <View style={{ flex: 1 }}>
      {/* Back Button */}
      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <Image
          className="h-auto"
          resizeMode="contain"
          source={require("../../assets/arrowLeft.png")}
        ></Image>
      </TouchableOpacity>

      {/* WebView */}
      <WebView
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction={true}
        source={{
          html: embedHtml,
        }}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        allowsFullscreenVideo
        style={{ flex: 1 }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  backButton: {
    position: "absolute",
    top: 40,
    left: 20,
    zIndex: 1, // Ensure it appears above the WebView
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 5,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 20,
  },
});

export default VideoShow;
