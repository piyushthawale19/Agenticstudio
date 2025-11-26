import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { NextResponse } from "next/server";
import { convertToModelMessages, streamText } from "ai";
import { currentUser } from "@clerk/nextjs/server";
import { getVideoDetails } from "@/actions/getVideoDetails";
import {
  TranscriptUnavailableError,
  getYoutubeTranscript,
} from "@/actions/getYoutubeTranscript";
import createFetchTranscriptTool from "@/tools/fetchTranscript";
import { generateImage } from "@/tools/generateImage";
import generateTitle from "@/tools/genrateTitle";

export const maxDuration = 120;

const google = createGoogleGenerativeAI({
  apiKey:
    process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY,
});

const model = google("models/gemini-2.5-flash");
const chatVideoMap = new Map<string, string>();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      id: chatId,
      messages = [],
      videoId: bodyVideoId,
      data,
    } = body as {
      id?: string;
      messages?: typeof body.messages;
      videoId?: string;
      data?: { videoId?: string };
    };

    const urlVideoId = new URL(req.url, "http://localhost").searchParams.get(
      "videoId"
    );

    // Extract videoId from body, nested data, querystring, or headers as fallback
    const headerVideoId = req.headers.get("x-video-id");

    let refererVideoId: string | null = null;
    const referer = req.headers.get("referer");
    if (referer) {
      try {
        const refererUrl = new URL(referer);
        const segments = refererUrl.pathname.split("/").filter(Boolean);
        const videoIndex = segments.indexOf("video");
        if (videoIndex >= 0) {
          refererVideoId = segments[videoIndex + 1] || null;
        }
      } catch (err) {
        console.warn("⚠️ Failed to parse referer for videoId", err);
      }
    }

    let videoId =
      bodyVideoId ||
      data?.videoId ||
      urlVideoId ||
      headerVideoId ||
      refererVideoId ||
      undefined;
    if (!videoId && chatId) {
      videoId = chatVideoMap.get(chatId);
      if (videoId) {
        console.log("♻️ Restored videoId from chat cache", { chatId, videoId });
      }
    }

    console.log("📥 Request body:", body);
    console.log(
      "📥 Header videoId:",
      headerVideoId,
      "Query videoId:",
      urlVideoId,
      "Referer videoId:",
      refererVideoId,
      "ChatId:",
      chatId
    );
    console.log("📥 Request received:", {
      videoId,
      messageCount: messages.length,
    });

    const user = await currentUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let videoDetails = null;
    if (videoId) {
      if (chatId && videoId) {
        chatVideoMap.set(chatId, videoId);
      }
      try {
        console.log("🔍 Fetching video details for videoId:", videoId);
        videoDetails = await getVideoDetails(videoId);
        console.log("✅ Video details fetched:", videoDetails?.title);
      } catch (error) {
        console.error("❌ Error fetching video details:", error);
      }
    } else {
      console.warn("⚠️ No videoId provided in request");
      if (chatId) {
        chatVideoMap.delete(chatId);
      }
      return NextResponse.json(
        { error: "Video context missing" },
        { status: 400 }
      );
    }

    const resolvedVideoTitle = videoDetails?.title || "the selected video";
    const resolvedChannelTitle =
      videoDetails?.channel?.title || "Unknown channel";
    const resolvedViews = videoDetails?.views || "Unknown";
    const resolvedPublished = videoDetails?.publishedAt || "Unknown";

    const latestUserMessage = getLatestUserMessageText(messages);
    const wantsTranscript = shouldTriggerTranscript(latestUserMessage);

    if (wantsTranscript) {
      try {
        const transcriptData = await getYoutubeTranscript(videoId);
        const transcriptSegments = transcriptData.transcript || [];

        if (!transcriptSegments.length) {
          throw new TranscriptUnavailableError();
        }

        const limitedSegments = transcriptSegments.slice(0, 60);
        const transcriptLines = limitedSegments
          .map((segment) => `[${segment.timestamp}] ${segment.text}`)
          .join("\n");

        const transcriptSystemMessage = `You are AgentTube, an upbeat AI assistant for the video "${resolvedVideoTitle}" by ${resolvedChannelTitle}. Always respond with the following bold, emoji-friendly Markdown structure so it mirrors the UI mock: \n\n## 📽️ Transcript for **${resolvedVideoTitle}**\n- One upbeat sentence that references the video title and includes 1-2 relevant emojis.\n\n### 📝 Transcript Summary\n- Bullet list of 4-6 key beats without any timestamps.\n\n### 🧩 Transcript Segments\n- [timestamp] exact quotes for at least five sequential segments (or every segment if fewer).\n\nKeep the tone encouraging, reference Manage Plan for upgrades when relevant, and end by inviting the user to keep exploring the video together.`;

        const userPrompt = `The user asked: "${latestUserMessage ?? "Provide the transcript."}"\n\nUse the transcript excerpts below to craft the summary and segment list. Quote the transcript faithfully.\n\nTranscript excerpts:\n${transcriptLines}`;

        const transcriptResult = await streamText({
          model,
          system: transcriptSystemMessage,
          messages: [{ role: "user", content: userPrompt }],
        });

        return transcriptResult.toUIMessageStreamResponse({
          originalMessages: messages,
          onFinish: (finalMessage) => {
            console.log(
              "/api/chat transcript final message:",
              JSON.stringify(finalMessage, null, 2)
            );
          },
          onError: (err) => String(err ?? "error"),
        });
      } catch (transcriptError) {
        console.error("❌ Transcript branch failed:", transcriptError);
        if (transcriptError instanceof TranscriptUnavailableError) {
          const unavailableSystemMessage = `You are AgentTube, a supportive AI copilot for video creators. When a transcript cannot be fetched, you must:
1. Start with the markdown heading "## Hello there👋 !" and mention "${resolvedVideoTitle}".
2. Empathetically explain that captions or a transcript are not available yet, without inventing any quotes.
3. Offer 2-3 helpful next steps (e.g., try another video, run an analysis, request a high-level summary) and mention the Manage Plan upgrade option if they need guaranteed transcripts.
4. Close by inviting the user to keep exploring the video together.`;

          const unavailablePrompt = `The user asked: "${
            latestUserMessage ?? "Please share the transcript."
          }" but YouTube did not expose a transcript for the video "${
            resolvedVideoTitle
          }" (id: ${videoId}). Explain that the transcript is unavailable right now—likely because captions are missing—and offer alternative actions they can take.`;

          const unavailableResult = await streamText({
            model,
            system: unavailableSystemMessage,
            messages: [{ role: "user", content: unavailablePrompt }],
          });

          return unavailableResult.toUIMessageStreamResponse({
            originalMessages: messages,
            onFinish: (finalMessage) => {
              console.log(
                "/api/chat transcript-unavailable message:",
                JSON.stringify(finalMessage, null, 2)
              );
            },
            onError: (err) => String(err ?? "error"),
          });
        }
        const overloadResponse = maybeCreateAIErrorResponse(transcriptError);
        if (overloadResponse) {
          return overloadResponse;
        }
        // Fall through to normal chat handling below so the user still gets a response.
      }
    }

    const systemMessage = `You are AgentTube, an upbeat AI assistant helping with the video "${resolvedVideoTitle}" by ${resolvedChannelTitle}.

  Video context you already know:
  - Title: ${resolvedVideoTitle}
  - Channel: ${resolvedChannelTitle}
  - Views: ${resolvedViews}
  - Published: ${resolvedPublished}
  - Video ID for tooling: ${videoId}

  Conversation rules:
  1. Always start the response with a standalone Markdown heading \`## Hello there👋 !\` so it renders bold and prominent, then immediately mention the video title in that opening section with 1-2 helpful emojis and a supportive co-creator tone.
  2. Never ask the user for the video ID—you already have it.
  3. A tool named "fetchTranscript" is available and preconfigured for this video. Whenever the user asks for the transcript, script, captions, notes, or anything requiring exact spoken content, immediately call that tool (it accepts empty input or {"videoId": "${videoId}"}) and wait for the result before replying.
  4. A tool named "generateTitle" is available for crafting video titles. When the user asks for a headline or specifies a tone (funny, dramatic, SEO, etc.), call that tool immediately and pass a short prompt summarizing their request. After the tool responds, celebrate the title and remind them it now appears under the Titles list.
  5. A tool named "generateImage" is available for creating professional YouTube thumbnails. When the user asks to "Generate a thumbnail" or "Generate an image", call this tool right away with a descriptive prompt based on the request and the video context. Mention that the final art lands in Thumbnail Generation.
    6. After you receive transcript data, structure the answer exactly like this so the headings stay bold with emojis:
      ## 📽️ Transcript for **${resolvedVideoTitle}**
      - One upbeat sentence that references the video title and uses 1-2 fitting emojis.
      ### 📝 Transcript Summary
      - Bullet points that capture the key beats without including timestamps.
      ### 🧩 Transcript Segments
      - [timestamp] text for at least five sequential segments (or every available segment if fewer). Stay faithful to the transcript wording.
      Close with an invitation to keep exploring the video together.
  7. If the transcript tool fails, apologize briefly, explain that the transcript could not be fetched, and suggest retrying later—never expose internal errors.
  8. For other questions, still reference this video context, use bullet lists for complex info, gently mention "Manage Plan" for premium upgrades, and prefer approachable language like "saved in your library" over technical jargon.`;

    const transcriptTool = createFetchTranscriptTool(videoId);

    try {
      const result = await streamText({
        model,
        system: systemMessage,
        messages: [
          { role: "system", content: systemMessage },
          ...convertToModelMessages(messages),
        ],
        tools: {
          fetchTranscript: transcriptTool,
          generateImage: generateImage({
            videoId,
            userId: user.id,
            videoTitle: resolvedVideoTitle,
            channelTitle: resolvedChannelTitle,
          }),
          generateTitle: generateTitle({
            videoId,
            userId: user.id,
            videoTitle: resolvedVideoTitle,
            channelTitle: resolvedChannelTitle,
          }),
        },
      });

      return result.toUIMessageStreamResponse({
        originalMessages: messages,
        onFinish: (finalMessage) => {
          console.log(
            "/api/chat assistant final message:",
            JSON.stringify(finalMessage, null, 2)
          );
        },
        onError: (err) => {
          // console.error("/api/chat stream error:", err);
          return String(err ?? "error");
        },
      });
    } catch (assistantError) {
      console.error("❌ Assistant stream failed:", assistantError);
      const response = maybeCreateAIErrorResponse(assistantError);
      if (response) {
        return response;
      }
      throw assistantError;
    }
  } catch (error: unknown) {
    console.error("/api/chat error", error);
    const response = maybeCreateAIErrorResponse(error);
    if (response) {
      return response;
    }
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

const TRANSCRIPT_KEYWORDS = [
  "transcript",
  "transcripts",
  "script",
  "scripts",
  "caption",
  "captions",
  "subtitle",
  "subtitles",
  "notes",
  "summary",
  "summaries",
  "summarize",
  "summarized",
  "synopsis",
  "recap",
  "overview",
  "detailed summary",
  "full summary",
];

const MAX_FUZZY_DISTANCE = 1;

type IncomingMessage = {
  role?: string;
  parts?: Array<{ type?: string; text?: string }>;
};

function getLatestUserMessageText(messages: IncomingMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message?.role !== "user") {
      continue;
    }
    const textParts = message.parts
      ?.filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => (part.text ?? "").trim())
      .filter(Boolean);
    if (textParts && textParts.length > 0) {
      return textParts.join(" ").trim();
    }
  }
  return null;
}

function shouldTriggerTranscript(
  messageText: string | null | undefined
): boolean {
  if (!messageText) {
    return false;
  }
  const lower = messageText.toLowerCase();
  if (TRANSCRIPT_KEYWORDS.some((keyword) => lower.includes(keyword))) {
    return true;
  }

  const words = lower.match(/[a-z0-9]+/g);
  if (!words) {
    return false;
  }

  return words.some((word) =>
    TRANSCRIPT_KEYWORDS.some((keyword) => {
      if (keyword.includes(" ")) {
        return false;
      }
      if (Math.abs(keyword.length - word.length) > MAX_FUZZY_DISTANCE) {
        return false;
      }
      return levenshteinDistance(word, keyword) <= MAX_FUZZY_DISTANCE;
    })
  );
}

function maybeCreateAIErrorResponse(error: unknown) {
  const details = getAIModelErrorDetails(error);
  if (!details) {
    return null;
  }
  return NextResponse.json(
    { error: details.message },
    { status: details.status }
  );
}

function getAIModelErrorDetails(
  error: unknown
): { status: number; message: string } | null {
  if (!error) {
    return null;
  }

  const primaryMessage = extractErrorMessage(error).toLowerCase();
  const reason = (error as { reason?: string })?.reason;
  const statusCode = (error as { statusCode?: number })?.statusCode;
  const lastErrorMessage = extractErrorMessage(
    (error as { lastError?: unknown })?.lastError
  ).toLowerCase();
  const combined = `${primaryMessage} ${lastErrorMessage}`;

  if (
    combined.includes("model is overloaded") ||
    combined.includes("503") ||
    combined.includes("unavailable")
  ) {
    return {
      status: 503,
      message:
        "The AI model is overloaded right now. Please wait a few seconds and try again.",
    };
  }

  if (reason === "maxRetriesExceeded") {
    return {
      status: 503,
      message:
        "The AI service could not respond after a few attempts. Give it another shot shortly.",
    };
  }

  if (statusCode === 429 || combined.includes("rate limit")) {
    return {
      status: 429,
      message:
        "We're hitting a temporary rate limit. Please slow down and retry in a moment.",
    };
  }

  return null;
}

function extractErrorMessage(error: unknown): string {
  if (!error) {
    return "";
  }
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message || "";
  }
  if (typeof error === "object" && error) {
    const maybeMessage = (error as { message?: string }).message;
    if (typeof maybeMessage === "string") {
      return maybeMessage;
    }
  }
  return "";
}

function levenshteinDistance(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}
