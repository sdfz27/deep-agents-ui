import { NextResponse } from "next/server";

export interface FeedbackToolCall {
  /** Tool name */
  name: string;
  /** Tool call arguments */
  args: Record<string, unknown>;
}

export interface FeedbackRequestBody {
  /** The thread ID for the conversation */
  threadId: string;
  /** The message ID of the AI response being rated */
  messageId: string;
  /** User's feedback: "thumbs_up" or "thumbs_down" */
  feedback: "thumbs_up" | "thumbs_down";
  /** The user's question (human message content) */
  question: string;
  /** The AI's answer (AI message content) */
  answer: string;
  /** Tool calls involved in generating the answer */
  toolCalls?: FeedbackToolCall[];
  /** User ID of the person giving feedback */
  userId?: string;
  /** Optional comment from the user */
  comment?: string;
}

export interface FeedbackLogEntry extends FeedbackRequestBody {
  /** Server-generated timestamp */
  timestamp: string;
}

export async function POST(req: Request) {
  let body: FeedbackRequestBody;
  try {
    body = (await req.json()) as FeedbackRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  const { threadId, messageId, feedback, question, answer } = body;

  if (!threadId || typeof threadId !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'threadId'" },
      { status: 400 }
    );
  }

  if (!messageId || typeof messageId !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'messageId'" },
      { status: 400 }
    );
  }

  if (feedback !== "thumbs_up" && feedback !== "thumbs_down") {
    return NextResponse.json(
      {
        error:
          "Invalid 'feedback' value. Must be 'thumbs_up' or 'thumbs_down'.",
      },
      { status: 400 }
    );
  }

  if (!question || typeof question !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'question'" },
      { status: 400 }
    );
  }

  if (!answer || typeof answer !== "string") {
    return NextResponse.json(
      { error: "Missing or invalid 'answer'" },
      { status: 400 }
    );
  }

  const logEntry: FeedbackLogEntry = {
    threadId,
    messageId,
    feedback,
    question,
    answer,
    toolCalls: Array.isArray(body.toolCalls) ? body.toolCalls : undefined,
    userId: typeof body.userId === "string" ? body.userId : undefined,
    comment: body.comment,
    timestamp: new Date().toISOString(),
  };

  // Log the feedback to the server console.
  // In production, you would persist this to a database or analytics service.
  console.log("[Feedback]", JSON.stringify(logEntry, null, 2));

  return NextResponse.json({ success: true, logged: logEntry });
}
