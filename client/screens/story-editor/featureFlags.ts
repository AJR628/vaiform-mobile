export function isUnifiedStoryboardSurfaceEnabled(): boolean {
  return process.env.EXPO_PUBLIC_STEP3_UNIFIED_SURFACE === "1";
}
