
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import type { ProcessedImageData, AnalyzeApiRequest } from '../types';

// This is a Vercel Serverless Function
// It runs on the server, not in the browser.

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { imageDatas, promptText } = req.body as AnalyzeApiRequest;

  if (!imageDatas || imageDatas.length === 0 || !promptText) {
    return res.status(400).json({ error: 'Missing image data or prompt text' });
  }

  const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;

  if (!API_KEY) {
    console.error("API_KEY is not configured in Vercel Environment Variables.");
    return res.status(500).json({ error: "Server configuration error: API key is missing." });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const imageParts: Part[] = imageDatas.map((imageData: ProcessedImageData) => ({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.base64,
      },
    }));

    const textPart: Part = {
      text: promptText,
    };

    const allParts: Part[] = [...imageParts, textPart];
    const model = "models/gemini-2.5-flash";

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: model,
      contents: { parts: allParts },
      config: {
        responseMimeType: "application/json",
      }
    });

    const textOutput = response.text;

    res.status(200).json({ text: textOutput });

  } catch (error: any) {
    console.error("Error calling Gemini API from serverless function:", error);
    res.status(500).json({ error: `Gemini API Error: ${error.message}` });
  }
}
