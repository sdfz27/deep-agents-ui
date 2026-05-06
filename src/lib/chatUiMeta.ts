import type { Message } from "@langchain/langgraph-sdk";

/** Stored on outbound human messages that must not appear in the chat UI. */
export const DEEP_AGENTS_UI_HIDDEN_KW = "deepAgentsUiHidden" as const;

export function isMessageHiddenFromUi(
  message: Message,
  hiddenHumanMessageIds?: ReadonlySet<string>
): boolean {
  if (message.type !== "human") return false;
  if (
    message.additional_kwargs?.[DEEP_AGENTS_UI_HIDDEN_KW] === true
  ) {
    return true;
  }
  if (message.id && hiddenHumanMessageIds?.has(message.id)) {
    return true;
  }
  return false;
}

/**
 * A round is one user question (visible human) followed by at least one AI reply
 * before the next visible human message.
 */
export function countCompletedConversationRounds(
  messages: Message[],
  isHidden: (m: Message) => boolean
): number {
  let rounds = 0;
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.type !== "human" || isHidden(m)) continue;
    let foundAi = false;
    for (let j = i + 1; j < messages.length; j++) {
      const next = messages[j];
      if (next.type === "human" && !isHidden(next)) break;
      if (next.type === "ai") {
        foundAi = true;
        break;
      }
    }
    if (foundAi) rounds++;
  }
  return rounds;
}
