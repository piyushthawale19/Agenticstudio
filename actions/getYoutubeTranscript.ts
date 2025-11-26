import { api } from "@/convex/_generated/api";
import { FeatureFlag, featureFlagEvents } from "@/features/flags";
import { ensureSchematicIdentity } from "@/lib/ensureSchematicIdentity";
import { client } from "@/lib/schematic";
import { currentUser } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { Innertube } from "youtubei.js";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export interface TranscriptEntry {
  text: string;
  timestamp: string; // in seconds
}

const youtube = await Innertube.create({
  lang: "en",
  location: "US",
  retrieve_player: false,
});

function formatTimestamp(start_ms: number): string {
  const minutes = Math.floor(start_ms / 60000);
  const seconds = Math.floor((start_ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export class TranscriptUnavailableError extends Error {
  constructor(message = "Transcript not available for this video.") {
    super(message);
    this.name = "TranscriptUnavailableError";
  }
}

export class ClerkAuthError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ClerkAuthError";
    this.status = status;
  }
}

async function fetchTranscript(videoId: string): Promise<TranscriptEntry[]> {
  try {
    const info = await youtube.getInfo(videoId);
    const transcriptData = await info.getTranscript();

    const transcript: TranscriptEntry[] =
      transcriptData.transcript.content?.body?.initial_segments.map(
        (segment) => ({
          text: segment.snippet.text ?? "N/A",
          timestamp: formatTimestamp(Number(segment.start_ms)),
        })
      ) ?? [];
    return transcript;
  } catch (error) {
    if (isTranscriptUnavailable(error)) {
      throw new TranscriptUnavailableError();
    }
    console.error("Error fetching transcript:", error);
    throw error instanceof Error ? error : new Error(String(error));
  }
}

type TranscriptOptions = {
  trackUsage?: boolean;
};

export async function getYoutubeTranscript(
  videoId: string,
  options: TranscriptOptions = {}
) {
  let user = null;
  try {
    user = await currentUser();
  } catch (authError) {
    const clerkStatus = getClerkErrorStatus(authError);
    if (clerkStatus) {
      throw new ClerkAuthError(
        clerkStatus,
        clerkStatus === 429
          ? "You're requesting transcripts too quickly. Please wait a few seconds and try again."
          : "Authentication service is temporarily unavailable. Please wait a moment and retry."
      );
    }
    throw authError;
  }

  if (!user?.id) {
    console.log("User not authenticated.");
    throw new Error("User not authenticated");
  }

  const shouldTrackUsage = options.trackUsage ?? true;

  // Always check for cached transcript first (even on refresh)
  const cachedTranscript = await getCachedTranscript(videoId, user.id);
  if (cachedTranscript?.length) {
    console.log("Serving cached transcript for", videoId);
    // Only track usage if shouldTrackUsage is true (fresh navigation from home)
    if (shouldTrackUsage) {
      await trackTranscriptUsage(user.id);
    }
    return {
      transcript: cachedTranscript,
      cache: shouldTrackUsage
        ? "Cached transcript reused – this request still counted toward your plan tokens."
        : "Cached transcript reused without updating plan usage.",
      isNew: false,
    };
  }

  // No cached transcript found
  // If shouldTrackUsage is false, don't fetch new transcript (refresh scenario)
  // Return empty but don't show error - let the UI handle the status
  if (!shouldTrackUsage) {
    return {
      transcript: [],
      cache: "",
      isNew: false,
    };
  }

  console.log("Fetching new transcript for videoId:", videoId);
  const transcript = await fetchTranscript(videoId);
  console.log(
    "Transcript fetched successfully. Persisting and tracking usage."
  );

  await storeTranscript(videoId, user.id, transcript);
  if (shouldTrackUsage) {
    await trackTranscriptUsage(user.id);
  }

  return {
    transcript,
    cache: shouldTrackUsage
      ? "Transcript saved to your library and tokens updated for this request."
      : "Transcript saved without updating usage metrics.",
    isNew: true,
  };
}

async function getCachedTranscript(videoId: string, userId: string) {
  try {
    const result = await convex.query(api.transcript.getTranscriptByVideoId, {
      videoId,
      userId,
    });
    if (result && Array.isArray(result.transcript)) {
      return result.transcript as TranscriptEntry[];
    }
  } catch (error) {
    console.warn(
      "Convex transcript lookup failed. Ensure `npx convex dev` is running. Falling back to YouTube fetch.",
      error
    );
  }
  return null;
}

async function storeTranscript(
  videoId: string,
  userId: string,
  transcript: TranscriptEntry[]
) {
  try {
    await convex.mutation(api.transcript.storeTranscript, {
      videoId,
      userId,
      transcript,
    });
  } catch (error) {
    console.warn(
      "Failed to store transcript in Convex (continuing without cache).",
      error
    );
  }
}

async function trackTranscriptUsage(userId: string) {
  try {
    await ensureSchematicIdentity(userId);
    await client.track({
      event: featureFlagEvents[FeatureFlag.TRANSCRIPTION].event,
      company: { id: userId },
      user: { userId },
    });
  } catch (error) {
    console.warn("Failed to track transcript usage. Continuing.", error);
  }
}

function isTranscriptUnavailable(error: unknown): boolean {
  const message = (
    error instanceof Error ? error.message : String(error || "")
  ).toLowerCase();
  return (
    message.includes("transcript panel not found") ||
    message.includes("type mismatch")
  );
}

function getClerkErrorStatus(error: unknown): number | null {
  if (!error || typeof error !== "object") {
    return null;
  }
  const maybeError = error as { clerkError?: boolean; status?: number };
  if (!maybeError?.clerkError) {
    return null;
  }
  return typeof maybeError.status === "number" ? maybeError.status : null;
}
