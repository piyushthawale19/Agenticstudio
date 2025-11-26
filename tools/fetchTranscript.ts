import { tool } from "ai";
import { z } from "zod";
import {
  TranscriptUnavailableError,
  getYoutubeTranscript,
} from "@/actions/getYoutubeTranscript";

const toolInputSchema = z.object({
  videoId: z
    .string()
    .optional()
    .describe(
      "Optional override for the YouTube video ID. When omitted, the default video in context is used."
    ),
});

const createFetchTranscriptTool = (defaultVideoId: string) =>
  tool({
    description:
      "Fetches the transcript of a YouTube video in concise segments.",
    inputSchema: toolInputSchema,
    execute: async ({ videoId }: { videoId?: string } = {}) => {
      const resolvedVideoId = videoId ?? defaultVideoId;
      if (!resolvedVideoId) {
        throw new Error("Video ID is required to fetch a transcript.");
      }

      try {
        const transcript = await getYoutubeTranscript(resolvedVideoId);
        return {
          cache: transcript.cache,
          transcript: transcript.transcript,
          videoId: resolvedVideoId,
          error: null,
        };
      } catch (error) {
        const friendlyMessage =
          error instanceof TranscriptUnavailableError
            ? error.message
            : "The transcript could not be fetched right now. Please try again later.";

        console.warn("Transcript tool failed:", error);
        return {
          cache: friendlyMessage,
          transcript: [],
          videoId: resolvedVideoId,
          error: friendlyMessage,
        };
      }
    },
  });

export default createFetchTranscriptTool;
