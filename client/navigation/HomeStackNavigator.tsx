import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import HomeScreen from "@/screens/HomeScreen";
import StoryEditorScreen from "@/screens/StoryEditorScreen";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useScreenOptions } from "@/hooks/useScreenOptions";

export type HomeStackParamList = {
  Home: undefined;
  StoryEditor: { sessionId: string };
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
    </Stack.Navigator>
  );
}
