import { z } from 'zod';

// Tipos de documento suportados pelo fluxo de extração.
export const DOCUMENT_TYPES = ['mtr', 'mmr'] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// Formatos aceitos pelo Gemini para entrada multimodal (PDF nativo + imagens).
export const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const MAX_FILES = 10;

// Tamanho máximo do payload aceito pela função serverless (limite prático da Vercel ~4,5 MB).
export const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

export const processedFileSchema = z.object({
  base64: z.string().min(1),
  mimeType: z.enum(ALLOWED_MIME_TYPES),
  fileName: z.string().min(1),
  pageNumber: z.number().int().positive().optional(),
});

export const analyzeRequestSchema = z.object({
  // 'mtr' como padrão preserva chamadas de clientes que ainda não enviam o campo.
  documentType: z.enum(DOCUMENT_TYPES).default('mtr'),
  imageDatas: z
    .array(processedFileSchema)
    .min(1, 'Nenhum arquivo enviado para análise.')
    .max(MAX_FILES, `Máximo de ${MAX_FILES} arquivos por análise.`),
});

export type ProcessedImageData = z.infer<typeof processedFileSchema>;
export type AnalyzeApiRequest = z.infer<typeof analyzeRequestSchema>;

export interface ExtractedField {
  topic: string;
  answer: string;
}

export interface ExtractedSection {
  sectionTitle: string;
  fields: ExtractedField[];
}

export type GeminiJsonResponse = ExtractedSection[];

// Schema da resposta estruturada da IA, usado para validar o JSON recebido no cliente.
export const extractedFieldSchema = z.object({
  topic: z.string(),
  answer: z.string(),
});

export const extractedSectionSchema = z.object({
  sectionTitle: z.string(),
  fields: z.array(extractedFieldSchema),
});

export const geminiResponseSchema = z.array(extractedSectionSchema);
