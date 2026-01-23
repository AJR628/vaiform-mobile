import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "@/screens/HomeScreen";
import StoryEditorScreen from "@/screens/StoryEditorScreen";
import ClipSearchModal from "@/screens/ClipSearchModal";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type HomeStackParamList = {
  Home: undefined;
  StoryEditor: { sessionId: string };
  ClipSearch: { sessionId: string; sentenceIndex: number };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

export default function HomeStackNavigator() {
  const screenOptions = useScreenOptions();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{
          headerTitle: () => <HeaderTitle title="Vaiform" />,
        }}
      />
      <Stack.Screen
        name="StoryEditor"
        component={StoryEditorScreen}
        options={{
          headerTitle: "Storyboard Editor",
        }}
      />
      <Stack.Screen
        name="ClipSearch"
        component={ClipSearchModal}
        options={{
          presentation: "modal",
          headerTitle: "Replace Clip",
        }}
      />
    </Stack.Navigator>
  );
}
