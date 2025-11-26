// "use server";

// import { getConvexClient } from "@/lib/convex";
// import { currentUser } from "@clerk/nextjs/server";
// // import OpenAI from "openai";
// import { GoogleGenerativeAI } from "@google/generative-ai";

// const convexClient = getConvexClient(); // import from "@/lib/convex"

// export async function generateTitle(
//   videoId: string,
//   videoSummary: string,
//   considerations: string
// ) {
//   const user = await currentUser();

//   if (!user?.id) {
//     throw new Error("User not found");
//   }

//   const openai = new OpenAI ({
//     apiKey: process.env.OPENAI_API_KEY,
//   });

//   console.log("🟢 Video summary:", videoSummary);
//   console.log("🎯 Generating title for videoId:", videoId);
//   console.log("📌 Considerations:", considerations);

//   try {
//     const response = await openai.chat.completions.create({
//       model: ""gemini-2.0-flash",
//       messages: [
//         {
//           role: "system",
//           content:
//             "You are a helpful YouTube video creator assistant that creates high quality SEO friendly concise video titles.",
//         },
//         {
//           role: "user",
//           content: `Please provide ONE concise YouTube title (and nothing else) for this video. Focus on the main points and key takeaways, it should be SEO friendly and 100 characters or less.\n\n${videoSummary}\n\n${considerations}`,
//         },
//       ],
//     });

//     return response;
//   } catch (error) {
//     console.error("❌ Error generating title:", error);
//     throw new Error("Failed to generate title");
//   }
// }

"use server";

// import { convex } from "@/components/ConvexClientProvider";
import { api } from "@/convex/_generated/api";
import { currentUser } from "@clerk/nextjs/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getConvexClient } from "@/lib/convex";
import { client } from "@/lib/schematic";
import { FeatureFlag, featureFlagEvents } from "@/features/flags";
import { getVideoDetails } from "@/actions/getVideoDetails";
import { ensureSchematicIdentity } from "@/lib/ensureSchematicIdentity";

const GEMINI_TITLE_MODEL =
  process.env.GEMINI_TITLE_MODEL ||
  process.env.GOOGLE_GENERATIVE_AI_MODEL ||
  "gemini-2.0-flash";

const SYSTEM_PROMPT =
  "You are a creative YouTube video title generator. Generate UNIQUE, ORIGINAL titles that are different each time. Never repeat the same title twice. Use varied vocabulary, different angles, and creative approaches. Each title must be SEO-friendly, engaging, and 100 characters or less.";

const resolveGeminiApiKey = () =>
  process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
  process.env.GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY_IMG ||
  "";

type TitleGenerationParams = {
  videoId: string;
  instructions?: string;
  summaryOverride?: string;
};

export async function generateTitle({
  videoId,
  instructions = "",
  summaryOverride,
}: TitleGenerationParams) {
  const convexClient = getConvexClient();
  const user = await currentUser();

  if (!user?.id) {
    throw new Error("User not found");
  }

  const apiKey = resolveGeminiApiKey();

  if (!apiKey) {
    throw new Error("Gemini API key not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: GEMINI_TITLE_MODEL,
    generationConfig: {
      temperature: 0.95, // Higher temperature for more variation
      maxOutputTokens: 120,
      topP: 0.95, // Increase diversity
      topK: 50, // More creative sampling
    },
  });

  console.log("🎯 Generating title for videoId:", videoId);
  console.log("🧠 User instructions:", instructions);

  const videoDetails = await getVideoDetails(videoId);
  const derivedSummary =
    summaryOverride?.trim() ||
    (videoDetails
      ? `Title: ${videoDetails.title}. Channel: ${videoDetails.channel?.title}. Published: ${videoDetails.publishedAt}. Views: ${videoDetails.views}.`
      : "");

  // Add timestamp and random element to ensure uniqueness
  const timestamp = Date.now();
  const randomSeed = Math.floor(Math.random() * 1000);

  const promptSegments = [
    `IMPORTANT: Create a COMPLETELY UNIQUE and ORIGINAL title. Never repeat previous titles. Use fresh vocabulary and creative angles.`,
    `Generate ONE concise, SEO-friendly YouTube title (100 characters or less).`,
    `Video context: ${derivedSummary || `Video ID ${videoId}`}`,
    `Variation seed: ${timestamp}-${randomSeed}`,
    `Make it different from: "${videoDetails?.title || ""}"`,
  ];

  const trimmedInstructions = instructions.trim();
  if (trimmedInstructions) {
    promptSegments.push(`User style preference: ${trimmedInstructions}`);
  }

  promptSegments.push(
    `Remember: Be creative, use synonyms, try different formats (questions, statements, emotional hooks). Each title MUST be unique.`
  );

  const prompt = promptSegments.join("\n");

  try {
    const response = await model.generateContent({
      systemInstruction: SYSTEM_PROMPT,
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
    });

    const title =
      response.response?.text()?.trim() || "Unable to generate title";

    if (!title) {
      throw new Error("Gemini did not return a title");
    }

    await convexClient.mutation(api.titles.generate, {
      videoId,
      userId: user.id,
      title: title,
    });

    try {
      await ensureSchematicIdentity(user.id);
      await client.track({
        event: featureFlagEvents[FeatureFlag.TITLE_GENERATIONS].event,
        company: {
          id: user.id,
        },
        user: {
          userId: user.id,
        },
      });
    } catch (trackingError) {
      console.warn("⚠️ Unable to track title usage", trackingError);
    }

    console.log("(@-@) Title generated", title);

    return title;
  } catch (error) {
    console.error("❌ Error generating title with Gemini:", error);
    throw new Error("Failed to generate title");
  }
}
