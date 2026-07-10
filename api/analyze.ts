import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, GenerateContentResponse, Part } from '@google/genai';
import { analyzeRequestSchema, MAX_PAYLOAD_BYTES, type ProcessedImageData } from '../types';
import { EXTRACTION_PROMPT } from './prompt';

// Função serverless da Vercel. Roda no servidor, nunca no navegador.
// Tempo máximo de execução (chamadas multimodais podem ser longas).
export const config = { maxDuration: 60 };

const MODEL = 'models/gemini-2.5-flash';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  // Rejeita payloads grandes antes de qualquer processamento (limite prático da Vercel).
  const payloadBytes = Buffer.byteLength(
    typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? ''),
    'utf8',
  );
  if (payloadBytes > MAX_PAYLOAD_BYTES) {
    return res.status(413).json({
      error:
        'Os arquivos enviados são grandes demais. Envie menos arquivos ou arquivos menores e tente novamente.',
    });
  }

  const parsed = analyzeRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return res.status(400).json({
      error: firstIssue?.message || 'Requisição inválida.',
    });
  }

  const { imageDatas } = parsed.data;

  const API_KEY = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!API_KEY) {
    console.error('GEMINI_API_KEY não está configurada nas variáveis de ambiente da Vercel.');
    return res.status(500).json({ error: 'Erro de configuração do servidor: chave de API ausente.' });
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });

    const fileParts: Part[] = imageDatas.map((file: ProcessedImageData) => ({
      inlineData: {
        mimeType: file.mimeType,
        data: file.base64,
      },
    }));

    const allParts: Part[] = [...fileParts, { text: EXTRACTION_PROMPT }];

    const response: GenerateContentResponse = await ai.models.generateContent({
      model: MODEL,
      contents: { parts: allParts },
      config: {
        responseMimeType: 'application/json',
      },
    });

    return res.status(200).json({ text: response.text });
  } catch (error: any) {
    console.error('Erro ao chamar a API do Gemini na função serverless:', error);
    return res.status(500).json({ error: `Erro da API Gemini: ${error?.message || 'desconhecido'}` });
  }
}
