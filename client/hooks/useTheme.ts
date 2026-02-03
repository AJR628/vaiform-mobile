import { useMemo } from "react";
import { Colors } from "@/constants/theme";
import { FORCED_COLOR_SCHEME } from "@/constants/appearance";
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
  const systemScheme = useColorScheme();
  const scheme = FORCED_COLOR_SCHEME ?? systemScheme ?? "light";
  const isDark = scheme === "dark";

  const theme = useMemo<ExtendedTheme>(
    () => {
      const baseTheme = Colors[scheme];
      return {
        ...baseTheme,
        textPrimary: baseTheme.text,
        textSecondary: baseTheme.tabIconDefault,
        textTertiary: baseTheme.tabIconDefault,
        primary: baseTheme.link,
      };
    },
    [scheme]
  );

  return {
    theme,
    isDark,
  };
}
