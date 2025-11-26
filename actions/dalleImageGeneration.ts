"use server";

import { api } from "@/convex/_generated/api";
import { FeatureFlag, featureFlagEvents } from "@/features/flags";
import { getConvexClient } from "@/lib/convex";
import { ensureSchematicIdentity } from "@/lib/ensureSchematicIdentity";
import { client } from "@/lib/schematic";
import { Doc } from "@/convex/_generated/dataModel";
import { currentUser } from "@clerk/nextjs/server";
import OpenAI from "openai";

type OpenAIImageSize =
  | "1024x1024"
  | "512x512"
  | "256x256"
  | "1792x1024"
  | "1024x1792"
  | "1536x1024"
  | "1024x1536";

const DEFAULT_IMAGE_SIZE: OpenAIImageSize = "1024x1024"; // cheaper default (~$0.04/img)
const ALLOWED_IMAGE_SIZES = new Set<OpenAIImageSize>([
  "1024x1024",
  "512x512",
  "256x256",
  "1792x1024",
  "1024x1792",
  "1536x1024",
  "1024x1536",
]);
const IMAGE_SIZE: OpenAIImageSize = ((): OpenAIImageSize => {
  const requested = process.env.OPENAI_IMAGE_SIZE?.trim() as
    | OpenAIImageSize
    | undefined;
  if (requested && ALLOWED_IMAGE_SIZES.has(requested)) {
    return requested;
  }
  return DEFAULT_IMAGE_SIZE;
})();

export const dalleImageGeneration = async (
  prompt: string,
  videoId: string
): Promise<{ imageUrl: string; storageId: string }> => {
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

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY environment variable is not configured");
  }

  const openai = new OpenAI({ apiKey });

  console.log("🎨 Generating DALL-E image with prompt:", prompt);

  try {
    // Step 1: Generate image with DALL-E
    const imageResponse = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      n: 1,
      size: IMAGE_SIZE,
      quality: "standard",
      style: "vivid",
    });

    if (!imageResponse.data || imageResponse.data.length === 0) {
      throw new Error(
        "Failed to generate image - no data returned from OpenAI"
      );
    }

    const generatedImageUrl = imageResponse.data[0]?.url;
    if (!generatedImageUrl) {
      throw new Error("Failed to generate image - no URL in response");
    }

    console.log("✅ Image generated successfully from DALL-E");

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

    // Step 3: Download image from DALL-E
    console.log("📥 Downloading image from DALL-E...");
    let arrayBuffer: ArrayBuffer;
    try {
      const imageRes = await fetch(generatedImageUrl);
      if (!imageRes.ok) {
        throw new Error(`Failed to download image: ${imageRes.statusText}`);
      }
      arrayBuffer = await imageRes.arrayBuffer();
    } catch (error) {
      console.error("Error downloading image:", error);
      throw new Error("Failed to download generated image from DALL-E");
    }

    console.log("✅ Image downloaded, size:", arrayBuffer.byteLength, "bytes");

    // Step 4: Upload image to Convex storage
    console.log("📤 Uploading image to Convex storage...");
    let uploadResponse: Response;
    try {
      uploadResponse = await fetch(postUrl, {
        method: "POST",
        headers: { "Content-Type": "image/png" },
        body: arrayBuffer,
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
    try {
      await convexClient.mutation(api.images.saveImage, {
        storageId: uploadedFile.storageId as any,
        videoId,
        userId: user.id,
      });
    } catch (error) {
      console.error("Error saving image metadata:", error);
      throw new Error("Failed to save image metadata to database");
    }

    console.log("✅ Image metadata saved to database");

    const waitForImageUrl = async () => {
      const startedAt = Date.now();
      const timeoutMs = 60_000;
      const retryDelayMs = 1_500;

      const sleep = (ms: number) =>
        new Promise((resolve) => setTimeout(resolve, ms));

      while (Date.now() - startedAt < timeoutMs) {
        try {
          const savedImages =
            ((await convexClient.query(api.images.getImages, {
              videoId,
              userId: user.id,
            })) as Array<Doc<"images"> & { url: string | null }>) ?? [];

          const matchingImage = savedImages.find(
            (entry) =>
              entry.storageId === uploadedFile.storageId && Boolean(entry.url)
          );

          if (matchingImage?.url) {
            console.log("✅ Retrieved image URL from database");
            return matchingImage.url as string;
          }
        } catch (error) {
          console.warn("Retrying thumbnail lookup after error:", error);
        }

        await sleep(retryDelayMs);
        console.log("⏳ Waiting for Convex to expose the thumbnail URL…");
      }

      throw new Error(
        "Image saved but the URL is still processing. Please refresh in a few seconds."
      );
    };

    const savedImageUrl = await waitForImageUrl();

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
      imageUrl: savedImageUrl,
      storageId: uploadedFile.storageId,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("❌ DALL-E Generation Error:", errorMessage);

    // Provide specific error messages for common issues
    if (errorMessage.includes("401") || errorMessage.includes("Unauthorized")) {
      throw new Error(
        "Invalid OpenAI API key. Check OPENAI_API_KEY in .env.local"
      );
    }
    if (errorMessage.includes("429")) {
      throw new Error(
        "Rate limited by OpenAI. Please try again in a few moments."
      );
    }
    if (
      errorMessage.includes("content_policy") ||
      errorMessage.includes("content policy")
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
};

// import { api } from "@/convex/_generated/api";
// import { getConvexClient } from "@/lib/convex";
// import { currentUser } from "@clerk/nextjs/server";
// import OpenAI from "openai";

// const IMAGE_SIZE = "1792x1024" as const;
// const convexClient = getConvexClient();

// export const dalleImageGeneration = async (prompt: string, videoId: string) => {
//   const user = await currentUser();

//   if (!user?.id) {
//     throw new Error("User not found");
//   }

//   const openai = new OpenAI({
//     apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY2,
//   });

//   // continue with generation logic here
//   const imageResponse = await openai.images.generate({
//     model: "dall-e-3",
//     prompt: prompt,
//     n: 1,
//     size: IMAGE_SIZE,
//     quality: "standard",
//     style: "vivid",
//   })

//   const imageUrl = imageResponsee.data[0]?.url;

//   if(!imageUrl){
//     throw new Error("failed to generate images")
//   }
//   console.log("Getting upload URL...")
//   const postUrl = await convexClient.mutation(api.images.generateUploadUrl)
//   console.log("Got upload URL")
// };
