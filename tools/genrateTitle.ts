import { generateTitle as generateTitleAction } from "@/actions/titleGeneration";
import { FeatureFlag } from "@/features/flags";
import { client } from "@/lib/schematic";
import { tool } from "ai";
import { z } from "zod";

type GenerateTitleOptions = {
  videoId: string;
  userId: string;
  videoTitle?: string | null;
  channelTitle?: string | null;
};

const fallbackInstruction = (
  videoTitle?: string | null,
  channelTitle?: string | null
) => {
  const title = videoTitle?.trim() || "this video";
  const channel = channelTitle?.trim() || "this creator";
  return `Craft an engaging, high-retention YouTube title for "${title}" by ${channel}.`;
};

export const generateTitle = ({
  videoId,
  userId,
  videoTitle,
  channelTitle,
}: GenerateTitleOptions) =>
  tool({
    description:
      "Generates a YouTube-ready title for the currently selected video. Provide the tone or angle you want in the prompt.",
    inputSchema: z.object({
      prompt: z
        .string()
        .describe(
          "Tone, style, or specific angle for the title (e.g., 'make it funny' or 'focus on AI productivity')."
        )
        .optional(),
    }),
    execute: async ({ prompt }: { prompt?: string } = {}) => {
      const schematicCtx = {
        company: { id: userId },
        user: { id: userId },
      };

      const isTitleGenerationEnabled = await client.checkFlag(
        schematicCtx,
        FeatureFlag.TITLE_GENERATIONS
      );

      if (!isTitleGenerationEnabled) {
        return {
          error:
            "Title generation is not enabled yet. Ask the creator to upgrade their Manage Plan.",
        };
      }

      const trimmedPrompt = prompt?.trim();
      const instructions =
        trimmedPrompt && trimmedPrompt.length > 0
          ? trimmedPrompt
          : fallbackInstruction(videoTitle, channelTitle);

      const title = await generateTitleAction({
        videoId,
        instructions,
      });

      return {
        title,
        message: trimmedPrompt
          ? undefined
          : "No custom tone detected, so a balanced SEO title was generated automatically.",
      };
    },
  });

export default generateTitle;
