"use client";

import React, { useState, useCallback } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type FeedbackValue = "thumbs_up" | "thumbs_down" | null;

interface FeedbackToolCall {
  name: string;
  args: Record<string, unknown>;
}

interface FeedbackButtonsProps {
  /** Thread ID for the current conversation */
  threadId: string;
  /** Message ID of the AI response */
  messageId: string;
  /** The user's question that preceded this AI message */
  question: string;
  /** The AI message content */
  answer: string;
  /** Tool calls involved in generating the answer */
  toolCalls?: FeedbackToolCall[];
  /** User ID for feedback attribution */
  userId?: string;
}

export const FeedbackButtons = React.memo<FeedbackButtonsProps>(
  ({ threadId, messageId, question, answer, toolCalls, userId }) => {
    const [feedback, setFeedback] = useState<FeedbackValue>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submitFeedback = useCallback(
      async (value: "thumbs_up" | "thumbs_down") => {
        // Toggle off if clicking the same button
        const newValue = feedback === value ? null : value;
        const previousFeedback = feedback;
        setFeedback(newValue);

        if (newValue === null) {
          // User un-selected their feedback – no need to log
          return;
        }

        setIsSubmitting(true);
        try {
          const res = await fetch("/api/feedback", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              threadId,
              messageId,
              feedback: newValue,
              question,
              answer,
              toolCalls,
              userId,
            }),
          });

          if (!res.ok) {
            console.error("Feedback submission failed:", await res.text());
            // Revert on failure
            setFeedback(previousFeedback);
          }
        } catch (err) {
          console.error("Feedback submission error:", err);
          setFeedback(previousFeedback);
        } finally {
          setIsSubmitting(false);
        }
      },
      [feedback, threadId, messageId, question, answer, toolCalls, userId]
    );

    return (
      <div className="mt-1 flex items-center gap-1" id={`feedback-${messageId}`}>
        <button
          type="button"
          onClick={() => submitFeedback("thumbs_up")}
          disabled={isSubmitting}
          aria-label="Thumbs up"
          aria-pressed={feedback === "thumbs_up"}
          className={cn(
            "group relative rounded-md p-1.5 transition-all duration-200",
            "hover:bg-emerald-500/10",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40",
            "disabled:pointer-events-none disabled:opacity-40",
            feedback === "thumbs_up"
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "text-muted-foreground/50 hover:text-emerald-600 dark:hover:text-emerald-400"
          )}
        >
          <ThumbsUp
            size={14}
            strokeWidth={feedback === "thumbs_up" ? 2.5 : 1.75}
            className={cn(
              "transition-transform duration-200",
              feedback === "thumbs_up" && "scale-110"
            )}
          />
          {feedback === "thumbs_up" && (
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.6)]" />
          )}
        </button>
        <button
          type="button"
          onClick={() => submitFeedback("thumbs_down")}
          disabled={isSubmitting}
          aria-label="Thumbs down"
          aria-pressed={feedback === "thumbs_down"}
          className={cn(
            "group relative rounded-md p-1.5 transition-all duration-200",
            "hover:bg-red-500/10",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40",
            "disabled:pointer-events-none disabled:opacity-40",
            feedback === "thumbs_down"
              ? "bg-red-500/15 text-red-500 dark:text-red-400"
              : "text-muted-foreground/50 hover:text-red-500 dark:hover:text-red-400"
          )}
        >
          <ThumbsDown
            size={14}
            strokeWidth={feedback === "thumbs_down" ? 2.5 : 1.75}
            className={cn(
              "transition-transform duration-200",
              feedback === "thumbs_down" && "scale-110"
            )}
          />
          {feedback === "thumbs_down" && (
            <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-red-500 shadow-[0_0_4px_rgba(239,68,68,0.6)]" />
          )}
        </button>
      </div>
    );
  }
);

FeedbackButtons.displayName = "FeedbackButtons";
