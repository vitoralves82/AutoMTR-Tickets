
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import type { ProcessedImageData } from '../types'; // Updated import path

// Attempt to get API_KEY from process.env.
// This will result in 'undefined' if 'process', 'process.env', or 'process.env.API_KEY' is not available.
// This prevents a ReferenceError if 'process' is not defined in the execution environment.
const API_KEY = (typeof process !== 'undefined' && process.env) ? process.env.API_KEY : undefined;

let ai: GoogleGenAI | null = null;

const getGenAIClient = (): GoogleGenAI => {
  if (!API_KEY) {
    console.error("API_KEY is not configured. Ensure process.env.API_KEY is set and accessible in the execution environment.");
    throw new Error("API_KEY is not configured. Please ensure process.env.API_KEY is set and accessible. This app cannot function without it.");
  }
  if (!ai) {
    ai = new GoogleGenAI({ apiKey: API_KEY });
  }
  return ai;
};

export const analyzeImagesWithGemini = async (
  imageDatas: ProcessedImageData[], // Accepts an array of ProcessedImageData
  promptText: string
): Promise<string> => {
  if (!imageDatas || imageDatas.length === 0) {
    throw new Error("No image data provided for analysis.");
  }

  try {
    const genAI = getGenAIClient();
    
    const imageParts: Part[] = imageDatas.map(imageData => ({
      inlineData: {
        mimeType: imageData.mimeType,
        data: imageData.base64,
      },
    }));

    const textPart: Part = {
      text: promptText,
    };

    const model = "gemini-2.5-flash-preview-04-17";

    // Combine all image parts with the single text prompt
    const allParts: Part[] = [...imageParts, textPart];

    const response: GenerateContentResponse = await genAI.models.generateContent({
      model: model,
      contents: { parts: allParts },
      config: {
        responseMimeType: "application/json",
        // temperature: 0.7, // Optional: Add other configs if needed
        // topK: 32,
      }
    });
    
    const textOutput = response.text;
    if (typeof textOutput === 'string') {
        return textOutput;
    } else {
        console.warn("Gemini API returned an unexpected response format. Expected text (JSON string).", response);
        if (typeof response === 'object' && response !== null) {
          try {
            return JSON.stringify(response);
          } catch (e) {
             return "Received an unexpected non-string, non-serializable response format from the AI.";
          }
        }
        return "Received an unexpected non-string response format from the AI.";
    }

  } catch (error: any) {
    console.error("Error calling Gemini API:", error);
    if (error && typeof error.message === 'string' && error.message.includes("API key not valid")) {
        throw new Error("Invalid API Key. Please check your API key configuration.");
    }
    const detailedMessage = (error && typeof error.message === 'string') ? error.message : "An unknown error occurred while communicating with the Gemini API.";
    throw new Error(`Gemini API Error: ${detailedMessage}`);
  }
};
