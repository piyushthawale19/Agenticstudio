import OpenAI from "openai";

const testOpenAIKey = async () => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY not found in environment variables");
    process.exit(1);
  }

  console.log("🔑 Testing OpenAI API Key...");
  console.log(
    `Key (first 20 chars): ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 10)}`
  );

  const openai = new OpenAI({ apiKey });

  try {
    console.log("\n📝 Attempting to generate a test image with DALL-E 3...");
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: "A simple blue square",
      n: 1,
      size: "1024x1024",
      quality: "standard",
    });

    if (response.data && response.data.length > 0) {
      console.log("✅ API Key is VALID! Image generated successfully.");
      console.log(`Image URL: ${response.data[0].url}`);
      console.log("\n✨ Your OpenAI API key is working correctly!");
      process.exit(0);
    } else {
      console.error("❌ No image data returned from API");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("\n❌ API Key Test FAILED!");

    if (error.status === 401) {
      console.error("Error: UNAUTHORIZED - Your API key is invalid or expired");
      console.error("  - Check that the key is correct");
      console.error("  - Check that the key hasn't been deactivated");
      console.error("  - Check that you have credits/billing set up");
    } else if (error.status === 429) {
      console.error("Error: RATE LIMIT - Too many requests");
      console.error("  - Try again in a few moments");
    } else if (error.status === 500) {
      console.error("Error: OpenAI Server Error - Try again later");
    } else {
      console.error(`Error: ${error.message}`);
      console.error(`Status: ${error.status}`);
    }

    console.error("\nFull error details:", error);
    process.exit(1);
  }
};

testOpenAIKey();
