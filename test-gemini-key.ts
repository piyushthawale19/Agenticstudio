import { GoogleGenerativeAI } from "@google/generative-ai";
import * as dotenv from "dotenv";
import * as path from "path";

// Load .env.local
dotenv.config({ path: path.resolve(".env.local") });

const testGeminiAPI = async () => {
  const apiKey = process.env.GEMINI_API_KEY_IMG;

  if (!apiKey) {
    console.error("❌ GEMINI_API_KEY_IMG not found in environment variables");
    process.exit(1);
  }

  console.log("🔑 Testing Gemini API Key...");
  console.log(
    `Key (first 20 chars): ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 10)}`
  );

  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    console.log("\n📝 Attempting to generate a test thumbnail image...");
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const response = await model.generateContent([
      {
        text: "Create a simple test image: a red circle on a white background",
      },
    ]);

    if (response.response) {
      const candidates = response.response.candidates;
      if (candidates && candidates.length > 0) {
        const imagePart = candidates[0].content?.parts?.find((part: any) =>
          part.inlineData?.mimeType?.startsWith("image/")
        );

        if (imagePart && imagePart.inlineData?.data) {
          console.log("✅ API Key is VALID! Image generated successfully.");
          console.log(
            `Image size: ${imagePart.inlineData.data.length} bytes (base64)`
          );
          console.log("\n✨ Your Gemini API key is working correctly!");
          process.exit(0);
        } else {
          console.error(
            "❌ No image data returned from API. The model may have rejected the request."
          );
          process.exit(1);
        }
      } else {
        console.error("❌ No candidates in response");
        process.exit(1);
      }
    } else {
      console.error("❌ No response from API");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("\n❌ API Key Test FAILED!");
    console.error(`Error: ${error.message}`);
    if (error.status) {
      console.error(`Status: ${error.status}`);
    }
    console.error("\nFull error details:", error);
    process.exit(1);
  }
};

testGeminiAPI();
