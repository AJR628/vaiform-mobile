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
  const baseTheme = Colors[colorScheme ?? "light"];

  // Add semantic aliases
  const theme: ExtendedTheme = {
    ...baseTheme,
    textPrimary: baseTheme.text,
    textSecondary: baseTheme.tabIconDefault,
    textTertiary: baseTheme.tabIconDefault,
    primary: baseTheme.link,
  };

  return {
    theme,
    isDark,
  };
}
