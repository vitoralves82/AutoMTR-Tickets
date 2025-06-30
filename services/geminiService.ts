import { GoogleGenAI } from "@google/genai";
import type { ProcessedImageData } from '../types';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

if (!API_KEY) {
  console.error('VITE_GEMINI_API_KEY não configurada.');
  throw new Error('API key não configurada. Defina VITE_GEMINI_API_KEY no Vercel e redeploy.');
}

let ai: GoogleGenAI | null = null;
const getGenAIClient = (): GoogleGenAI => {
  if (!ai) ai = new GoogleGenAI(API_KEY);
  return ai;
};

export const analyzeImagesWithGemini = async (
  images: ProcessedImageData[] | undefined,
  prompt: string
): Promise<string> => {
  try {
    const client = getGenAIClient();
    const model = client.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const parts: any[] = [{ text: prompt }];
    if (images && images.length) {
      images.forEach(img => parts.push({ 
        inlineData: { 
          data: img.base64, 
          mimeType: img.mimeType 
        } 
      }));
    }

    const response = await model.generateContent(parts);
    return response.response.text();
  } catch (error: any) {
    console.error('Erro na chamada Gemini API:', error);
    throw new Error(`Gemini API Error: ${error?.message || 'Unknown error.'}`);
  }
};
