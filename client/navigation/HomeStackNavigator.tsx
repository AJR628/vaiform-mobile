import React from "react";
import { createNativeStackNavigator, NativeStackNavigationProp } from "@react-navigation/native-stack";
import HomeScreen from "@/screens/HomeScreen";
import StoryEditorScreen from "@/screens/StoryEditorScreen";
import ClipSearchModal from "@/screens/ClipSearchModal";
import ScriptScreen from "@/screens/ScriptScreen";
import { FlowTabsHeader } from "@/components/FlowTabsHeader";
import { useScreenOptions } from "@/hooks/useScreenOptions";
import { useTheme } from "@/hooks/useTheme";
import { useActiveStorySession } from "@/contexts/ActiveStorySessionContext";
import { useToast } from "@/contexts/ToastContext";

export type HomeStackParamList = {
  Home: undefined;
  StoryEditor: { sessionId: string };
  ClipSearch: {
    sessionId: string;
    sentenceIndex: number;
    initialQuery?: string;
  };
  Script: { sessionId: string };
};

const Stack = createNativeStackNavigator<HomeStackParamList>();

interface HomeFlowHeaderProps {
  navigation: NativeStackNavigationProp<HomeStackParamList, "Home">;
}

function HomeFlowHeader({ navigation }: HomeFlowHeaderProps) {
  const { showError } = useToast();
  const { activeSessionId, isHydrated } = useActiveStorySession();

  return (
    <FlowTabsHeader
      currentStep="create"
      onCreatePress={undefined}
      onScriptPress={() => {
        if (!isHydrated || !activeSessionId) {
          if (isHydrated) showError("Create a script first");
          return;
        }
        navigation.navigate("Script", { sessionId: activeSessionId });
      }}
      onStoryboardPress={() => {
        if (!isHydrated || !activeSessionId) {
          if (isHydrated) showError("Create a script first");
          return;
        }
        navigation.navigate("StoryEditor", { sessionId: activeSessionId });
      }}
      disabledSteps={{
        script: !isHydrated || !activeSessionId,
        storyboard: !isHydrated || !activeSessionId,
      }}
      renderDisabled={true}
    />
  );
}

interface ScriptFlowHeaderProps {
  navigation: NativeStackNavigationProp<HomeStackParamList, "Script">;
  sessionId: string;
}

function ScriptFlowHeader({ navigation, sessionId }: ScriptFlowHeaderProps) {
  return (
    <FlowTabsHeader
      currentStep="script"
      onCreatePress={() => navigation.popToTop()}
      onScriptPress={undefined}
      onStoryboardPress={() => navigation.replace("StoryEditor", { sessionId })}
      renderDisabled={true}
    />
  );
}

export default function HomeStackNavigator() {
  const screenOptions = useScreenOptions();
  const { theme } = useTheme();

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          headerTitle: () => <HomeFlowHeader navigation={navigation} />,
          headerBackVisible: false,
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen
        name="StoryEditor"
        component={StoryEditorScreen}
        options={{
          headerTransparent: false,
          headerTitle: () => null,
          headerStyle: { backgroundColor: theme.backgroundRoot },
          headerTintColor: theme.text,
          headerTitleStyle: { color: theme.text, fontSize: 16, fontWeight: "600" },
          headerShadowVisible: false,
          headerBackVisible: false,
          headerBackTitleVisible: false,
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
      <Stack.Screen
        name="Script"
        component={ScriptScreen}
        options={({ navigation, route }) => ({
          headerTitle: () => (
            <ScriptFlowHeader navigation={navigation} sessionId={route.params.sessionId} />
          ),
          headerBackVisible: false,
          headerBackTitleVisible: false,
        })}
      />
    </Stack.Navigator>
  );
}
