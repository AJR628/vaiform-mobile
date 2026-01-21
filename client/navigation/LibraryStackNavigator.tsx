import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Pressable } from "react-native";
import { Feather } from "@expo/vector-icons";

import LibraryScreen from "@/screens/LibraryScreen";
import ShortDetailScreen from "@/screens/ShortDetailScreen";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";

export type LibraryStackParamList = {
  Library: undefined;
  ShortDetail: { id: string };
};

const Stack = createNativeStackNavigator<LibraryStackParamList>();

export default function LibraryStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Library"
        component={LibraryScreen}
        options={{
          headerTitle: "Library",
          headerRight: () => (
            <Pressable
              onPress={() => console.log("Search pressed")}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Feather name="search" size={22} color={theme.text} />
            </Pressable>
          ),
        }}
      />
      <Stack.Screen
        name="ShortDetail"
        component={ShortDetailScreen}
        options={{
          headerTitle: "Short Details",
        }}
      />
    </Stack.Navigator>
  );
}
