"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import {
  type Message,
  type Assistant,
  type Checkpoint,
} from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import type { UseStreamThread } from "@langchain/langgraph-sdk/react";
import type { TodoItem } from "@/app/types/types";
import { useClient } from "@/providers/ClientProvider";
import { useQueryState } from "nuqs";
import {
  countCompletedConversationRounds,
  DEEP_AGENTS_UI_HIDDEN_KW,
  isMessageHiddenFromUi,
} from "@/lib/chatUiMeta";

export type StateType = {
  messages: Message[];
  todos: TodoItem[];
  files: Record<string, string>;
  email?: {
    id?: string;
    subject?: string;
    page_content?: string;
  };
  ui?: any;
};

/** Dedupes identical hidden init submits (e.g. React Strict Mode double-mount). */
let lastHiddenInitDedupe: { content: string; at: number } | null = null;
const HIDDEN_INIT_DEDUPE_MS = 800;

export interface ChatThreadOptions {
  maxConversationRounds?: number;
  threadInitializationMessage?: string;
}

export function useChat({
  activeAssistant,
  onHistoryRevalidate,
  thread,
  chatThreadOptions,
}: {
  activeAssistant: Assistant | null;
  onHistoryRevalidate?: () => void;
  thread?: UseStreamThread<StateType>;
  chatThreadOptions?: ChatThreadOptions;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const client = useClient();
  const hiddenHumanIdsRef = useRef<Set<string>>(new Set());
  const initSentForNullThreadRef = useRef(false);
  const prevThreadIdForInitRef = useRef<string | null | undefined>(undefined);

  const maxRounds = chatThreadOptions?.maxConversationRounds;
  const initMessage = chatThreadOptions?.threadInitializationMessage?.trim() ?? "";

  const stream = useStream<StateType>({
    assistantId: activeAssistant?.assistant_id || "",
    client: client ?? undefined,
    reconnectOnMount: true,
    threadId: threadId ?? null,
    onThreadId: setThreadId,
    defaultHeaders: { "x-auth-scheme": "langsmith" },
    // Enable fetching state history when switching to existing threads
    fetchStateHistory: true,
    // Revalidate thread list when stream finishes, errors, or creates new thread
    onFinish: onHistoryRevalidate,
    onError: onHistoryRevalidate,
    onCreated: onHistoryRevalidate,
    experimental_thread: thread,
  });

  const isHiddenFromUi = useCallback(
    (m: Message) => isMessageHiddenFromUi(m, hiddenHumanIdsRef.current),
    []
  );

  const completedConversationRounds = useMemo(
    () => countCompletedConversationRounds(stream.messages, isHiddenFromUi),
    [stream.messages, isHiddenFromUi]
  );

  const isConversationRoundLimitReached =
    maxRounds !== undefined &&
    maxRounds > 0 &&
    completedConversationRounds >= maxRounds;

  const submitHumanMessage = useCallback(
    (content: string, hiddenFromUi: boolean) => {
      if (hiddenFromUi) {
        const now = Date.now();
        if (
          lastHiddenInitDedupe &&
          lastHiddenInitDedupe.content === content &&
          now - lastHiddenInitDedupe.at < HIDDEN_INIT_DEDUPE_MS
        ) {
          return;
        }
        lastHiddenInitDedupe = { content, at: now };
      }
      const id = uuidv4();
      const newMessage: Message = {
        id,
        type: "human",
        content,
        ...(hiddenFromUi
          ? {
              additional_kwargs: {
                [DEEP_AGENTS_UI_HIDDEN_KW]: true,
              },
            }
          : {}),
      };
      if (hiddenFromUi) {
        hiddenHumanIdsRef.current.add(id);
      }
      stream.submit(
        { messages: [newMessage] },
        {
          ...(hiddenFromUi
            ? {}
            : {
                optimisticValues: (prev) => ({
                  messages: [...(prev.messages ?? []), newMessage],
                }),
              }),
          config: { ...(activeAssistant?.config ?? {}), recursion_limit: 100 },
        }
      );
      onHistoryRevalidate?.();
    },
    [stream, activeAssistant?.config, onHistoryRevalidate]
  );

  const sendMessage = useCallback(
    (content: string) => {
      if (isConversationRoundLimitReached) return;
      submitHumanMessage(content, false);
    },
    [submitHumanMessage, isConversationRoundLimitReached]
  );

  useEffect(() => {
    const prev = prevThreadIdForInitRef.current;
    prevThreadIdForInitRef.current = threadId;
    if (prev !== undefined && prev !== null && threadId === null) {
      initSentForNullThreadRef.current = false;
      lastHiddenInitDedupe = null;
    }
  }, [threadId]);

  useEffect(() => {
    if (threadId !== null) return;
    if (!initMessage) return;
    if (!activeAssistant?.assistant_id) return;
    if (initSentForNullThreadRef.current) return;
    initSentForNullThreadRef.current = true;
    submitHumanMessage(initMessage, true);
  }, [
    threadId,
    initMessage,
    activeAssistant?.assistant_id,
    submitHumanMessage,
  ]);

  const runSingleStep = useCallback(
    (
      messages: Message[],
      checkpoint?: Checkpoint,
      isRerunningSubagent?: boolean,
      optimisticMessages?: Message[]
    ) => {
      if (checkpoint) {
        stream.submit(undefined, {
          ...(optimisticMessages
            ? { optimisticValues: { messages: optimisticMessages } }
            : {}),
          config: activeAssistant?.config,
          checkpoint: checkpoint,
          ...(isRerunningSubagent
            ? { interruptAfter: ["tools"] }
            : { interruptBefore: ["tools"] }),
        });
      } else {
        stream.submit(
          { messages },
          { config: activeAssistant?.config, interruptBefore: ["tools"] }
        );
      }
    },
    [stream, activeAssistant?.config]
  );

  const setFiles = useCallback(
    async (files: Record<string, string>) => {
      if (!threadId) return;
      // TODO: missing a way how to revalidate the internal state
      // I think we do want to have the ability to externally manage the state
      await client.threads.updateState(threadId, { values: { files } });
    },
    [client, threadId]
  );

  const continueStream = useCallback(
    (hasTaskToolCall?: boolean) => {
      stream.submit(undefined, {
        config: {
          ...(activeAssistant?.config || {}),
          recursion_limit: 100,
        },
        ...(hasTaskToolCall
          ? { interruptAfter: ["tools"] }
          : { interruptBefore: ["tools"] }),
      });
      // Update thread list when continuing stream
      onHistoryRevalidate?.();
    },
    [stream, activeAssistant?.config, onHistoryRevalidate]
  );

  const markCurrentThreadAsResolved = useCallback(() => {
    stream.submit(null, { command: { goto: "__end__", update: null } });
    // Update thread list when marking thread as resolved
    onHistoryRevalidate?.();
  }, [stream, onHistoryRevalidate]);

  const resumeInterrupt = useCallback(
    (value: any) => {
      stream.submit(null, { command: { resume: value } });
      // Update thread list when resuming from interrupt
      onHistoryRevalidate?.();
    },
    [stream, onHistoryRevalidate]
  );

  const stopStream = useCallback(() => {
    stream.stop();
  }, [stream]);

  return {
    stream,
    todos: stream.values.todos ?? [],
    files: stream.values.files ?? {},
    email: stream.values.email,
    ui: stream.values.ui,
    setFiles,
    messages: stream.messages,
    isLoading: stream.isLoading,
    isThreadLoading: stream.isThreadLoading,
    interrupt: stream.interrupt,
    getMessagesMetadata: stream.getMessagesMetadata,
    sendMessage,
    runSingleStep,
    continueStream,
    stopStream,
    markCurrentThreadAsResolved,
    resumeInterrupt,
    completedConversationRounds,
    isConversationRoundLimitReached,
    isMessageHiddenFromUi: isHiddenFromUi,
  };
}
