import 'dotenv/config';
import axios from 'axios';
import * as path from 'path';
import * as fs from 'fs';

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  require('dotenv').config({ path: envPath });
}

const generateImage = async () => {
  try {
    // Check if API key is available
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error("❌ OPENAI_API_KEY is not set in environment variables");
      console.log("📝 Please add your OpenAI API key to .env.local file:");
      console.log("   OPENAI_API_KEY=sk-your-actual-api-key-here");
      return;
    }

    if (!apiKey.startsWith('sk-')) {
      console.error("❌ Invalid OpenAI API key format. Should start with 'sk-'");
      return;
    }

    console.log("🔑 Using OpenAI API key:", apiKey.substring(0, 10) + "...");
    
    const response = await axios.post(
      'https://api.openai.com/v1/images/generations',
      {
        prompt: "Golden retrievers running joyfully on the beach at sunset",
        n: 1,
        size: "1024x1024",
        quality: "hd",
        model: "dall-e-3"
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const imageUrl = response.data.data[0].url;
    console.log("✅ Image generated successfully!");
    console.log("🖼️ Image URL:", imageUrl);
  } catch (error: any) {
    console.error("❌ Error generating image:");
    if (error.response?.data) {
      console.error("   API Error:", error.response.data);
    } else {
      console.error("   Error:", error.message);
    }
  }
};

generateImage();