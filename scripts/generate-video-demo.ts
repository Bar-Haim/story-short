import { config } from 'dotenv';
config({ path: '.env.local' });

import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const prompts = [
  "Golden retriever puppies running joyfully in a flower field, cinematic 9:16, ultra detailed",
  "Golden retrievers playing in the streets of New York, sunny day, cinematic, vertical",
  "Golden retrievers running along the Hawaiian beach at sunset, splashing water, cinematic 9:16"
];

async function generateImages() {
  const imageDir = path.resolve(__dirname, 'generated-images');
  if (!fs.existsSync(imageDir)) fs.mkdirSync(imageDir);

  for (let i = 0; i < prompts.length; i++) {
    const prompt = prompts[i];
    console.log(`🎨 Generating image ${i + 1}/3`);

    try {
      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt,
        n: 1,
        size: '1024x1792', // יחס 9:16 לצורך וידאו אנכי
        response_format: 'url'
      });

      if (!response.data || response.data.length === 0) {
        throw new Error('No image data received from OpenAI');
      }

      const imageUrl = response.data[0].url;
      if (!imageUrl) {
        throw new Error('No image URL received from OpenAI');
      }

      console.log(`✅ Image URL: ${imageUrl}`);

      // Download and save locally
      const imagePath = path.join(imageDir, `scene_${i + 1}.png`);
      const imageResponse = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      fs.writeFileSync(imagePath, imageResponse.data);
      console.log(`💾 Saved to ${imagePath}`);
    } catch (error: any) {
      console.error(`❌ Failed to generate image ${i + 1}:`, error.message || error);
    }
  }
}

generateImages();