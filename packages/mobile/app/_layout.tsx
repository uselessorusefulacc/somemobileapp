import { Slot } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { colors } from "../lib/theme";
import { RelayProvider } from "../lib/relay-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 10000 },
  },
});

export default function RootLayout() {
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
