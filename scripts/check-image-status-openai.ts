import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const API_KEY = process.env.LEONARDO_API_KEY;
const GENERATION_ID = process.env.LEONARDO_GENERATION_ID;

if (!API_KEY || !GENERATION_ID) {
  console.error('❌ Missing API key or Generation ID in .env.local');
  process.exit(1);
}

const checkStatus = async () => {
  try {
    const response = await axios.get(
      `https://cloud.leonardo.ai/api/rest/v1/generations/${GENERATION_ID}`,
      {
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const status = response.data.sdGenerationJob.status;
    const images = response.data.generations_by_pk.generated_images;

    if (status === 'COMPLETE' && images.length > 0) {
      console.log('✅ Image is ready!');
      images.forEach((img: any, index: number) => {
        console.log(`🖼️ Image #${index + 1}: ${img.url}`);
      });
    } else {
      console.log(`⏳ Status: ${status}. Still waiting...`);
    }
  } catch (error: any) {
    console.error('❌ Error checking status:', error.response?.data || error.message);
  }
};

checkStatus();