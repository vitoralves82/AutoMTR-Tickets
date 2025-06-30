
import type { ProcessedImageData, AnalyzeApiRequest } from '../types';

export const analyzeImagesWithGemini = async (
  imageDatas: ProcessedImageData[],
  promptText: string
): Promise<string> => {
  if (!imageDatas || imageDatas.length === 0) {
    throw new Error("No image data provided for analysis.");
  }

  try {
    const body: AnalyzeApiRequest = {
      imageDatas,
      promptText,
    };

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error from API: ${response.statusText}`);
    }

    const result = await response.json();
    return result.text;

  } catch (error: any) {
    console.error("Error calling backend API (/api/analyze):", error);
    const detailedMessage = (error && typeof error.message === 'string') 
      ? error.message 
      : "An unknown error occurred while communicating with the backend.";
    throw new Error(`API Error: ${detailedMessage}`);
  }
};
