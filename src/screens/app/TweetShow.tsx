import React from "react";
import { View, StyleSheet, Image, Text } from "react-native";
import { WebView } from "react-native-webview";
import { ITweet } from "../../interfaces/ITweet";
import moment from "moment";

const TweetPreview = ({ tweet }: any) => {
  return (
    <View className="bg-[#1A1A1A] rounded-xl p-4 mb-4">
      {/* Header */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Image
            source={{ uri: tweet.profile_image_url }}
            className="w-10 h-10 rounded-full mr-3"
          />
          <View>
            <Text className="text-white font-semibold">{tweet.name}</Text>
            <Text className="text-gray-400 text-sm">@{tweet.username}</Text>
          </View>
        </View>
        <Text className="text-gray-500 text-xs">
          {moment(tweet.created_at).fromNow()}
        </Text>
      </View>

      {/* Text */}
      <Text className="text-white mt-3 text-base">{tweet.text}</Text>

      {/* Media */}
      {tweet.media?.length > 0 && (
        <View className="mt-3 space-y-2">
          {tweet.media.map((m: any, i: number) => (
            <Image
              key={i}
              source={{ uri: m.url }}
              className="w-full h-60 rounded-lg"
              resizeMode="cover"
            />
          ))}
        </View>
      )}

      {/* Metrics */}
      <View className="flex-row justify-between mt-4 px-2">
        <Text className="text-gray-400 text-sm">
          💬 {tweet.metrics.reply_count}
        </Text>
        <Text className="text-gray-400 text-sm">
          🔁 {tweet.metrics.retweet_count}
        </Text>
        <Text className="text-gray-400 text-sm">
          ❤️ {tweet.metrics.like_count}
        </Text>
      </View>
    </View>
  );
};

export default TweetPreview;
