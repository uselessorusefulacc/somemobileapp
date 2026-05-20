import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { RelayClient } from "./relay";

interface RelayContextValue {
  client: RelayClient | null;
  isConnected: boolean;
  connect: (sessionId: string, relayUrl?: string) => void;
  disconnect: () => void;
}

const RelayContext = createContext<RelayContextValue | null>(null);

export function RelayProvider({ children }: { children: React.ReactNode }) {
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<RelayClient | null>(null);

  const connect = useCallback((sessionId: string, relayUrl?: string) => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
    const client = new RelayClient(sessionId, relayUrl);
    client.on("connected", () => setIsConnected(true));
    client.on("disconnected", () => setIsConnected(false));
    client.connect();
    clientRef.current = client;
  }, []);

  const disconnect = useCallback(() => {
    clientRef.current?.disconnect();
    clientRef.current = null;
    setIsConnected(false);
  }, []);

  return (
    <RelayContext.Provider value={{ client: clientRef.current, isConnected, connect, disconnect }}>
      {children}
    </RelayContext.Provider>
  );
}

export const useRelay = () => {
  const ctx = useContext(RelayContext);
  if (!ctx) throw new Error("useRelay must be used inside RelayProvider");
  return ctx;
};
