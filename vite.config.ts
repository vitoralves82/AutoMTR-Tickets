// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.')
    }
  },
  /**
   * BLOCO para evitar que o Vite tente resolver módulos nativos
   * (fsevents, node:path, etc.) no bundle do browser.
   */
  build: {
    rollupOptions: {
      external: [
        'fsevents', // só existe no macOS; ignora no browser
        'assert',
        'node:url',
        'node:path',
        'node:module',
        'node:process',
        'node:perf_hooks',
        'node:fs/promises',
        'node:fs',
        'fs',
        'path'
      ]
    }
  },
  optimizeDeps: {
    exclude: ['fsevents']
  }
});


// services/geminiService.ts
import { GoogleGenAI, GenerateContentResponse, Part } from "@google/genai";
import type { ProcessedImageData } from '../types'; // ajuste o caminho se necessário

/**
 * Chave API vinda do Vite. Lembre‑se: a variável TEM de chamar
 * VITE_GEMINI_API_KEY em Settings › Environment Variables.
 */
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY as string | undefined;

if (!API_KEY) {
  console.error('VITE_GEMINI_API_KEY não configurada.');
  throw new Error('API key não configurada. Defina VITE_GEMINI_API_KEY no Vercel e redeploy.');
}

let ai: GoogleGenAI | null = null;
const getGenAIClient = (): GoogleGenAI => {
  if (!ai) ai = new GoogleGenAI({ apiKey: API_KEY });
  return ai;
};

/**
 * Analisa imagens (ou só texto) usando o modelo Gemini‑pro.
 * Mantive a assinatura (images, prompt) para corresponder
 * ao import que existe no App.tsx.
 */
export const analyzeImagesWithGemini = async (
  images: ProcessedImageData[] | undefined,
  prompt: string
): Promise<GenerateContentResponse> => {
  try {
    const client = getGenAIClient();

    // Constrói partes: texto de prompt + array de imagens opcional
    const parts: Part[] = [{ text: prompt }];
    if (images && images.length) {
      images.forEach(img => parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } }));
    }

    const response = await client.generateContent({
      model: 'gemini-pro',
      contents: [{ role: 'user', parts }]
    });

    return response;
  } catch (error: any) {
    console.error('Erro na chamada Gemini API:', error);
    throw new Error(`Gemini API Error: ${error?.message || 'Unknown error.'}`);
  }
};
