import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import type { ProcessedImageData } from '../types'; // Atualize o caminho se necessário

// Pega a chave diretamente do bundle Vite (variável VITE_GEMINI_API_KEY)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

if (!API_KEY) {
  console.error("VITE_GEMINI_API_KEY não está configurada. Garanta que a variável de ambiente exista.");
  throw new Error("API key não configurada. Defina VITE_GEMINI_API_KEY no Vercel e redeploy.");
}

let ai: GoogleGenAI | null = null;

const getGenAIClient = (): GoogleGenAI => {
  if (!ai) ai = new GoogleGenAI({ apiKey: API_KEY });
  return ai;
};

/**
 * Chama a API do Gemini para gerar texto/imagem
 */
export const callGemini = async (
  prompt: string,
  images?: ProcessedImageData[]
): Promise<GenerateContentResponse> => {
  try {
    const client = getGenAIClient();
    const response = await client.generateContent({
      model: 'gemini-pro',
      prompt,
      images,
      // ajuste outros parâmetros conforme sua necessidade
    });
    return response;
  } catch (error: any) {
    console.error('Erro na chamada Gemini API:', error);
    if (error?.message?.includes('API key not valid')) {
      throw new Error('Chave de API inválida. Verifique sua configuração.');
    }
    throw new Error(`Gemini API Error: ${error.message || 'Unknown error.'}`);
  }
};
