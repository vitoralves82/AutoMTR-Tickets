import { geminiResponseSchema, type GeminiJsonResponse } from '../types';

export type ParseResult = { ok: true; data: GeminiJsonResponse } | { ok: false; error: string };

/**
 * Valida a resposta JSON da IA contra o schema compartilhado. Função pura: não
 * mexe em estado nem em UI — quem chama decide o que fazer com o resultado.
 */
export const parseGeminiResponse = (rawText: string | null): ParseResult => {
  if (!rawText) {
    return { ok: false, error: 'Resposta vazia da IA.' };
  }

  let json: unknown;
  try {
    json = JSON.parse(rawText);
  } catch (e: any) {
    return {
      ok: false,
      error: `Erro ao analisar os resultados: ${e?.message || 'erro desconhecido'}. Exibindo dados brutos.`,
    };
  }

  const result = geminiResponseSchema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      error: 'A resposta da IA não está no formato esperado. Exibindo dados brutos.',
    };
  }

  return { ok: true, data: result.data };
};
