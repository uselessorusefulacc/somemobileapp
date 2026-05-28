import React, { createContext, useContext, useRef, useEffect, useState, useCallback } from "react";
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
  // BUG-01 FIX: use state for client so consumers re-render when it changes
  const [client, setClient] = useState<RelayClient | null>(null);
  const clientRef = useRef<RelayClient | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (clientRef.current) {
        clientRef.current.removeAllListeners();
        clientRef.current.disconnect();
        clientRef.current = null;
      }
    };
  }, []);

  const connect = useCallback((sessionId: string, relayUrl?: string) => {
    // BUG-02 FIX: clean up old client's listeners before replacing
    if (clientRef.current) {
      clientRef.current.removeAllListeners();
      clientRef.current.disconnect();
    }
    const newClient = new RelayClient(sessionId, relayUrl);
    newClient.on("connected", () => setIsConnected(true));
    newClient.on("disconnected", () => setIsConnected(false));
    // When the daemon peer drops, flip to offline (keep WS alive for reconnect)
    newClient.on("peer_disconnected", () => setIsConnected(false));
    newClient.on("peer_connected", () => setIsConnected(true));
    newClient.connect();
    clientRef.current = newClient;
    setClient(newClient);
  }, []);

  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.removeAllListeners();
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    setClient(null);
    setIsConnected(false);
  }, []);

  return (
    <RelayContext.Provider value={{ client, isConnected, connect, disconnect }}>
      {children}
    </RelayContext.Provider>
  );
}

export const useRelay = () => {
  const ctx = useContext(RelayContext);
  if (!ctx) throw new Error("useRelay must be used inside RelayProvider");
  return ctx;
};
