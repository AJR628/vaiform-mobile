import { useMemo } from "react";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/useColorScheme";

type BaseTheme = typeof Colors.light;

export interface ExtendedTheme extends BaseTheme {
  // Semantic aliases for consistency across screens
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  primary: string;
}

export function useTheme() {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";

  const theme = useMemo<ExtendedTheme>(
    () => {
      const baseTheme = Colors[colorScheme ?? "light"];
      return {
        ...baseTheme,
        textPrimary: baseTheme.text,
        textSecondary: baseTheme.tabIconDefault,
        textTertiary: baseTheme.tabIconDefault,
        primary: baseTheme.link,
      };
    },
    [colorScheme]
  );

  return {
    theme,
    isDark,
  };
}
