"use client";

import { createContext, useContext, useMemo, ReactNode } from "react";
import { Client } from "@langchain/langgraph-sdk";

interface ClientContextValue {
  client: Client;
  userId?: string;
}

const ClientContext = createContext<ClientContextValue | null>(null);

interface ClientProviderProps {
  children: ReactNode;
  deploymentUrl: string;
  apiKey: string;
  /** When set with userId, sent on every LangGraph request (e.g. OAuth user id). */
  userIdHeaderName?: string;
  userId?: string;
}

export function ClientProvider({
  children,
  deploymentUrl,
  apiKey,
  userIdHeaderName,
  userId,
}: ClientProviderProps) {
  const client = useMemo(() => {
    const defaultHeaders: Record<string, string> = {
      "Content-Type": "application/json",
      "X-Api-Key": apiKey,
    };
    if (userIdHeaderName && userId) {
      defaultHeaders[userIdHeaderName] = userId;
    }
    return new Client({
      apiUrl: deploymentUrl,
      defaultHeaders,
    });
  }, [deploymentUrl, apiKey, userIdHeaderName, userId]);

  const value = useMemo(() => ({ client, userId }), [client, userId]);

  return (
    <ClientContext.Provider value={value}>{children}</ClientContext.Provider>
  );
}

export function useClient(): Client {
  const context = useContext(ClientContext);

  if (!context) {
    throw new Error("useClient must be used within a ClientProvider");
  }
  return context.client;
}

export function useUserId(): string | undefined {
  const context = useContext(ClientContext);
  return context?.userId;
}
