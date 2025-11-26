#!/usr/bin/env node
import OpenAI from "openai";

const testOpenAIKey = async () => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    console.error("❌ OPENAI_API_KEY is not set in .env.local");
    process.exit(1);
  }

  console.log("🔍 Testing OpenAI API Key...");
  console.log(
    `Key format: ${apiKey.substring(0, 10)}...${apiKey.substring(apiKey.length - 5)}`
  );

  const openai = new OpenAI({ apiKey });

  try {
    // Test with a simple list models call (lowest cost/risk)
    console.log("\n📝 Testing API connection...");
    const models = await openai.models.list();
    console.log("✅ API Key is VALID!");
    console.log(`✅ Successfully connected to OpenAI`);
    console.log(`📊 Available models: ${models.data.length} models found`);

    // Check if DALL-E is available
    const hasDALLE = models.data.some((m) => m.id.includes("dall-e"));
    if (hasDALLE) {
      console.log("✅ DALL-E 3 is available for image generation");
    }

    return true;
  } catch (error: any) {
    console.error("❌ API Key Test Failed!");
    if (error.status === 401) {
      console.error("❌ Invalid API Key - Check if the key is correct");
    } else if (error.status === 429) {
      console.error("❌ Rate limited - too many requests");
    } else if (error.code === "ENOTFOUND") {
      console.error("❌ Network error - check your internet connection");
    } else {
      console.error(`❌ Error: ${error.message}`);
    }
    return false;
  }
};

testOpenAIKey().then((success) => {
  process.exit(success ? 0 : 1);
});
