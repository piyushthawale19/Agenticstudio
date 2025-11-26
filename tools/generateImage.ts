// import { tool } from "ai";
// import { z } from "zod";

// const generateImageTool = tool({
//   description:
//     "Generates a placeholder thumbnail reference for the currently selected video.",
//   inputSchema: z.object({
//     videoId: z
//       .string()
//       .describe("YouTube video ID to derive the preview image from."),
//   }),
//   execute: async ({ videoId }: { videoId: string }) => {
//     // Return a lightweight payload so callers can swap in a real generator later.
//     return {
//       imageUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
//       altText: `Thumbnail preview for video ${videoId}`,
//     };
//   },
// });

// export default generateImageTool;


import { dalleImageGeneration } from "@/actions/dalleImageGeneration";
import { FeatureFlag } from "@/features/flags";
import { client } from "@/lib/schematic";
import { tool } from "ai";
import { z } from "zod";

type GenerateImageOptions = {
  videoId: string;
  userId: string;
  videoTitle?: string | null;
  channelTitle?: string | null;
};

const buildFallbackPrompt = (videoTitle?: string | null, channelTitle?: string | null) => {
  const title = videoTitle?.trim() || "this YouTube video";
  const channel = channelTitle?.trim() || "the channel owner";
  return [
    `Design a cinematic, high-contrast YouTube thumbnail for "${title}".`,
    "Feature the hosts on the left with expressive faces and a bokeh background.",
    `Add bold neon typography referencing the channel ${channel}.`,
    "Use vibrant purples and blues with subtle lens flare to match AgentTube branding.",
  ].join(" ");
};

export const generateImage = ({
  videoId,
  userId,
  videoTitle,
  channelTitle,
}: GenerateImageOptions) =>
  tool({
    description:
      "Generates a YouTube-ready thumbnail for the currently selected video. Provide a detailed prompt if you want a custom style.",
    inputSchema: z.object({
      prompt: z
        .string()
        .min(1)
        .describe(
          "Detailed description of the thumbnail to generate. If omitted, a default prompt based on the video will be used."
        )
        .optional(),
    }),
    execute: async ({ prompt }: { prompt?: string } = {}) => {
      const schematicCtx = {
        company: { id: userId },
        user: {
          id: userId,
        },
      };

      const isImageGenerationEnabled = await client.checkFlag(
        schematicCtx,
        FeatureFlag.IMAGE_GENERATION
      );

      if (!isImageGenerationEnabled) {
        return {
          error: "Image generation is not enabled, the user must upgrade",
        };
      }

      const trimmedPrompt = prompt?.trim();
      const finalPrompt =
        trimmedPrompt && trimmedPrompt.length > 0
          ? trimmedPrompt
          : buildFallbackPrompt(videoTitle, channelTitle);

      const image = await dalleImageGeneration(finalPrompt, videoId);
      return {
        image,
        message: trimmedPrompt
          ? undefined
          : "No custom prompt detected, so a default AgentTube thumbnail prompt was used.",
      };
    },
  });
