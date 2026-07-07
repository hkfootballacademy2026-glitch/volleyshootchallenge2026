import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" hidden />
      <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="difficulty" />
        <Stack.Screen name="game" />
        <Stack.Screen name="result" />
      </Stack>
    </>
  );
}
