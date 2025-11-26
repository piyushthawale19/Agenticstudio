"use server";

import { api } from "@/convex/_generated/api";
import { FeatureFlag, featureFlagEvents } from "@/features/flags";
import { getConvexClient } from "@/lib/convex";
import { ensureSchematicIdentity } from "@/lib/ensureSchematicIdentity";
import { client } from "@/lib/schematic";
import { currentUser } from "@clerk/nextjs/server";
import OpenAI from "openai";

const IMAGE_MODEL = "dall-e-3" as const;
const FALLBACK_IMAGE_SIZE = "512x512" as const; // faster generation and lower cost
const ALLOWED_IMAGE_SIZES = new Set([
  "1024x1024",
  "512x512",
  "256x256",
  //   "1792x1024",
  //   "1424x1424",
  // "1024x1792",
]);
const IMAGE_SIZE = ((): "1024x1024" | "512x512" | "256x256" => {
  const requested = process.env.OPENAI_IMAGE_SIZE?.trim() as
    | "1024x1024"
    | "512x512"
    | "256x256"
    | undefined;
  if (requested && ALLOWED_IMAGE_SIZES.has(requested)) {
    return requested;
  }
  return FALLBACK_IMAGE_SIZE;
})();
const IMAGE_QUALITY = "standard" as const;

const POLICY_KEYWORDS = [
  "content_policy",
  "content policy",
  "safety",
  "blocked",
  "rejected",
];

const sanitizePrompt = (input: string) =>
  input
    .replace(/https?:\/\/\S+/gi, "")
    .replace(/[<>]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const buildPrompt = (
  baseDescription: string
) => `You are a professional YouTube thumbnail designer.
Create a thumbnail that follows every platform safety policy and community guideline.

Thumbnail description: ${baseDescription}

Requirements:
- Visually appealing, vibrant, attention-grabbing
- 16:9 layout (1280x720) and safe for cropping
- Only stylized or abstract imagery, no photographic likeness of real people
- Use tasteful, family-friendly elements with inclusive representation
- If text is requested, keep it short, motivational, and generic (e.g., "Divine Melody")
- Avoid logos, trademarks, gore, politics, sensitive current events, or hateful imagery
- Professional studio-grade quality

Generate the image now.`;

const FALLBACK_PROMPT = buildPrompt(
  "Create a vibrant, family-friendly abstract thumbnail for an uplifting devotional music video. Use glowing light rays, warm saffron and golden gradients, and elegant bold text that says 'Divine Melody'. Include a stylized silhouette of a temple in the background with soft sparkles."
);

const isPolicyErrorMessage = (message: string) =>
  POLICY_KEYWORDS.some((keyword) => message.toLowerCase().includes(keyword));

export async function geminiImageGeneration(
  prompt: string,
  videoId: string
): Promise<{ imageUrl: string; storageId: string }> {
  const user = await currentUser();

  if (!user?.id) {
    throw new Error("User not authenticated");
  }

  if (!prompt || prompt.trim() === "") {
    throw new Error("Image prompt is required");
  }

  if (!videoId || videoId.trim() === "") {
    throw new Error("Video ID is required");
  }

  const apiKey =
    process.env.OPENAI_API_KEY ?? process.env.OPENAI_API_KEY_BACKUP ?? "";
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY (or OPENAI_API_KEY_BACKUP) environment variable is not configured"
    );
  }

  const openai = new OpenAI({ apiKey });
  console.log("🎨 Generating OpenAI thumbnail image with prompt:", prompt);

  try {
    // Step 1: Generate image with OpenAI DALL·E
    const sanitizedUserPrompt = sanitizePrompt(prompt);
    const promptAttempts = [
      {
        label: "primary",
        text: buildPrompt(
          sanitizedUserPrompt ||
            "Create a vibrant, professional YouTube thumbnail."
        ),
      },
      {
        label: "fallback",
        text: FALLBACK_PROMPT,
      },
    ];

    let imageBase64: string | null = null;
    let usedPromptLabel = "primary";
    let lastGenerationError: unknown = null;

    const generateWithPrompt = async (promptText: string, label: string) => {
      console.log(`🧠 OpenAI attempt (${label}) with prompt:`, promptText);
      const imageResponse = await openai.images.generate({
        model: IMAGE_MODEL,
        prompt: promptText,
        n: 1,
        size: IMAGE_SIZE,
        quality: IMAGE_QUALITY,
        response_format: "b64_json",
      });

      const imageData = imageResponse.data?.[0]?.b64_json;
      if (!imageData) {
        throw new Error(
          "Failed to generate image - no image data returned from OpenAI"
        );
      }

      return imageData;
    };

    for (const attempt of promptAttempts) {
      try {
        imageBase64 = await generateWithPrompt(attempt.text, attempt.label);
        usedPromptLabel = attempt.label;
        break;
      } catch (generationError) {
        lastGenerationError = generationError;
        const message =
          generationError instanceof Error
            ? generationError.message
            : String(generationError);
        console.warn(`⚠️ OpenAI ${attempt.label} prompt failed:`, message);

        if (isPolicyErrorMessage(message) && attempt.label !== "fallback") {
          console.warn(
            "🔁 Retrying OpenAI generation with safe fallback prompt..."
          );
          continue;
        }

        throw generationError;
      }
    }

    if (!imageBase64) {
      throw lastGenerationError || new Error("Failed to generate image");
    }

    console.log(
      `✅ Image generated successfully from OpenAI using ${usedPromptLabel} prompt`
    );

    // Step 2: Get upload URL from Convex
    console.log("📤 Getting Convex upload URL...");
    const convexClient = getConvexClient();

    let postUrl: string;
    try {
      postUrl = await convexClient.mutation(api.images.generateUploadUrl);
    } catch (error) {
      console.error("Error getting upload URL:", error);
      throw new Error(
        "Failed to get upload URL from Convex. Ensure Convex dev server is running."
      );
    }

    console.log("✅ Got Convex upload URL");

    // Step 3: Convert OpenAI image to Buffer
    console.log("📥 Converting OpenAI image to buffer...");
    let imageBuffer: Buffer;
    try {
      imageBuffer = Buffer.from(imageBase64, "base64");
    } catch (error) {
      console.error("Error converting image:", error);
      throw new Error("Failed to convert generated image from OpenAI");
    }

    console.log(
      "✅ Image converted to buffer, size:",
      imageBuffer.length,
      "bytes"
    );

    // Step 4: Upload image to Convex storage
    console.log("📤 Uploading image to Convex storage...");
    let uploadResponse: Response;
    try {
      uploadResponse = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: new Blob([new Uint8Array(imageBuffer)], { type: "image/png" }),
      });
    } catch (error) {
      console.error("Error uploading to Convex:", error);
      throw new Error("Failed to upload image to Convex storage");
    }

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error("Upload failed:", uploadResponse.status, errorText);
      throw new Error(
        `Failed to upload image to storage: ${uploadResponse.statusText}`
      );
    }

    let uploadedFile: { storageId: string };
    try {
      uploadedFile = await uploadResponse.json();
    } catch (error) {
      console.error("Error parsing upload response:", error);
      throw new Error("Failed to parse upload response from Convex");
    }

    if (!uploadedFile.storageId) {
      throw new Error("No storageId returned from upload");
    }

    console.log("✅ Image uploaded to Convex storage:", uploadedFile.storageId);

    // Step 5: Save image metadata to database
    console.log("💾 Saving image metadata to database...");
    const storageId = uploadedFile.storageId;
    try {
      await convexClient.mutation(api.images.saveImage, {
        // @ts-expect-error - Convex type compatibility
        storageId,
        videoId,
        userId: user.id,
      });
    } catch (error) {
      console.error("Error saving image metadata:", error);
      throw new Error("Failed to save image metadata to database");
    }

    console.log("✅ Image metadata saved to database");

    // Step 6: Get the full image URL from database
    console.log("🔍 Retrieving saved image URL...");
    let savedImages: Array<{
      url: string | null;
      storageId: string;
      videoId: string;
      userId: string;
    }>;
    try {
      savedImages = await convexClient.query(api.images.getImages, {
        videoId,
        userId: user.id,
      });
    } catch (error) {
      console.error("Error retrieving saved images:", error);
      throw new Error("Failed to retrieve saved image from database");
    }

    const savedImage = savedImages?.[0];
    if (!savedImage || !savedImage.url) {
      throw new Error("Failed to retrieve image URL from database");
    }

    console.log("✅ Retrieved image URL from database");

    // Step 7: Track usage with Schematic
    console.log("📊 Tracking image generation usage...");
    try {
      await ensureSchematicIdentity(user.id);
      await client.track({
        event: featureFlagEvents[FeatureFlag.IMAGE_GENERATION].event,
        company: {
          id: user.id,
        },
        user: {
          userId: user.id,
        },
      });
      console.log("✅ Usage tracked successfully");
    } catch (error) {
      console.warn("Warning: Failed to track usage, continuing anyway", error);
    }

    console.log("🎉 Image generation complete!");
    return {
      imageUrl: savedImage.url,
      storageId: uploadedFile.storageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ OpenAI Image Generation Error:", errorMessage);

    // Provide specific error messages for common issues
    if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
      throw new Error(
        "Invalid OpenAI API key. Check OPENAI_API_KEY / OPENAI_API_KEY_BACKUP in .env.local"
      );
    }
    if (errorMessage.includes("429") || errorMessage.includes("quota")) {
      throw new Error(
        "Rate limited by OpenAI. Please try again in a few moments."
      );
    }
    if (
      errorMessage.includes("content_policy") ||
      errorMessage.includes("content policy") ||
      errorMessage.includes("safety") ||
      errorMessage.includes("blocked") ||
      errorMessage.includes("rejected")
    ) {
      throw new Error(
        "Image prompt violates OpenAI content policy. Try a different description."
      );
    }
    if (errorMessage.includes("Cannot process image")) {
      throw new Error(
        "Generated image could not be processed. Please try again."
      );
    }

    throw error;
  }
}

/**
 * @deprecated Use geminiImageGeneration instead
 */
export const dalleImageGeneration = geminiImageGeneration;
