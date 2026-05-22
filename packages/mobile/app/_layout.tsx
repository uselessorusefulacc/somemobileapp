import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import { useEffect } from "react";
import { colors } from "../lib/theme";
import { RelayProvider } from "../lib/relay-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 10000 },
  },
});

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    "Geist-Regular": require("../assets/fonts/Geist-Regular.ttf"),
    "Geist-Medium": require("../assets/fonts/Geist-Medium.ttf"),
    "Geist-SemiBold": require("../assets/fonts/Geist-SemiBold.ttf"),
    "Geist-Bold": require("../assets/fonts/Geist-Bold.ttf"),
    "GeistMono-Regular": require("../assets/fonts/GeistMono-Regular.ttf"),
    "GeistMono-Medium": require("../assets/fonts/GeistMono-Medium.ttf"),
  });

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <RelayProvider>
          <StatusBar style="light" backgroundColor={colors.bg} />
          <Slot />
        </RelayProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
