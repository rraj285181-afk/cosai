import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
dotenv.config(); // load from current working directory (.env)
if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ path: '../.env' });
}

const geminiKey = process.env.GEMINI_API_KEY;
console.log('Using Key:', geminiKey ? geminiKey.substring(0, 10) + '...' : 'NONE');

if (!geminiKey) {
  console.error('No GEMINI_API_KEY found in .env');
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(geminiKey);

async function run() {
  try {
    // List models to see what is supported
    console.log('Fetching models list...');
    // We can also make a test request using a newer model
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const response = await model.generateContent('Hi');
    console.log('Gemini response for gemini-3.6-flash:', response.response.text());
  } catch (error) {
    console.error('Error with gemini-3.6-flash:', error.message);

    // Try gemini-1.5-pro
    try {
      console.log('Trying gemini-1.5-pro...');
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });
      const response = await model.generateContent('Hi');
      console.log('Gemini response for gemini-1.5-pro:', response.response.text());
    } catch (e2) {
      console.error('Error with gemini-1.5-pro:', e2.message);
    }
  }
}

run();
