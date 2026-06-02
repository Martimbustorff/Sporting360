import React, { useEffect, useState, useCallback } from "react";
import {
    Image,
    Platform,
    SafeAreaView,
    TouchableOpacity,
    View,
    Text,
    FlatList,
    RefreshControl,
    Linking,
    ActivityIndicator,
} from "react-native";
import Animated from "react-native-reanimated";
import { useNavigation } from "@react-navigation/native";

import { firebase } from "@react-native-firebase/firestore";
import TweetPreview from "./TweetShow";
import { ITweet } from "../../interfaces/ITweet";
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const News = () => {
    const navigation = useNavigation();
    const [tweets, setTweets] = useState<ITweet[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const insets = useSafeAreaInsets();

    // Initial fetch and real-time updates
    useEffect(() => {
        const subscriber = firebase
            .firestore()
            .collection("tweets")
            .orderBy("created_at", "desc")
            .onSnapshot((snapshot) => {
                const fetched = snapshot.docs.map((doc) => doc.data()) as ITweet[];
                setTweets(fetched);
                setLoading(false);
            });

        return () => subscriber();
    }, []);

    // Pull to refresh
    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            const snapshot = await firebase
                .firestore()
                .collection("tweets")
                .orderBy("created_at", "desc")
                .get();

            const refreshed = snapshot.docs.map((doc) => doc.data()) as ITweet[];
            setTweets(refreshed);
        } catch (err) {
            console.error("Refresh error:", err);
        } finally {
            setRefreshing(false);
        }
    }, []);

    const renderFooter = () =>
        !loading ? null : (
            <View className="py-4 flex items-center justify-center">
                <ActivityIndicator size="large" color="#1D9F5F" />
            </View>
        );

    const renderEmpty = () =>
        !loading && (
            <View className="flex-1 items-center justify-center mt-10">
                <Text className="text-white">No tweets available.</Text>
            </View>
        );

    const onLoadMore = () => {
        // Placeholder – can be extended to use pagination later
    };
    const openTweet = (username: string, tweetId: string) => {
        navigation.navigate("TwitterView", { username, tweetId });
    };
    return (
        <SafeAreaView className={`bg-bgauth flex-1 h-full justify-start items-center pb-16`}>
            <Image
                className="flex flex-1 absolute h-full w-full"
                source={require("../../assets/opacebg.png")}
            />
            <Animated.View style={{ backgroundColor: "#001B13" }} className="absolute h-full w-full opacity-80" />

            <View className="mt-2 w-full">
                {/* Header */}
                <View
                    style={{ height: Platform.OS === "android" ? 60 : 40, paddingTop: 30 }}
                    className={`w-full ${Platform.OS == "ios" ? "h-10 mb-6" : "h-10"} flex-row justify-center items-center`}
                >
                    <TouchableOpacity
                        style={{ paddingTop: Platform.OS === "android" ? 35 : 0 }}
                        className="w-12 h-12 absolute left-2 items-center"
                        onPress={() => navigation.goBack()}
                    >
                        <Image
                            className="h-auto"
                            resizeMode="contain"
                            source={require("../../assets/arrowLeft.png")}
                        />
                    </TouchableOpacity>
                    <Text className="font-dinBold h-6 mt-2 text-lg text-titleauth">NEWS</Text>
                </View>

                {/* Tweet List */}
                <View className="mt-8">
                    <FlatList
                        data={tweets}
                        keyExtractor={(item) => item.id}
                        renderItem={({ item }) =>
                            <TouchableOpacity onPress={() => openTweet(item.username, item.id)}>
                                <TweetPreview tweet={item} />
                            </TouchableOpacity>}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={handleRefresh}
                                colors={["#1D9F5F"]}
                                tintColor="#1D9F5F"
                            />
                        }
                        ListFooterComponent={renderFooter}
                        ListEmptyComponent={renderEmpty}
                        onEndReached={onLoadMore}
                        onEndReachedThreshold={0.5}
                        contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 60 }}
                        className="w-full"
                    />
                </View>
            </View>
        </SafeAreaView>
    );
};
