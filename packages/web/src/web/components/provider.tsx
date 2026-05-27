import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useRef } from "react";

interface ProviderProps {
  children: React.ReactNode;
}

// #151: was a no-op — now wires up QueryClientProvider
export function Provider({ children }: ProviderProps) {
  const queryClient = useRef(new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 10_000,
        retry: 1,
      },
    },
  })).current;

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
