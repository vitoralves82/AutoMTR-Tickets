import type { ProcessedImageData, AnalyzeApiRequest } from '../types';

// Envia os arquivos processados para a função serverless, que detém o prompt de
// extração e a chave de API. O cliente não envia mais o prompt.
export const analyzeImagesWithGemini = async (
  imageDatas: ProcessedImageData[],
): Promise<string> => {
  if (!imageDatas || imageDatas.length === 0) {
    throw new Error('Nenhum arquivo fornecido para análise.');
  }

  try {
    const body: AnalyzeApiRequest = { imageDatas };

    const response = await fetch('/api/analyze', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Erro da API: ${response.statusText}`);
    }

    const result = await response.json();
    return result.text;
  } catch (error: any) {
    console.error('Erro ao chamar a API de backend (/api/analyze):', error);
    const detailedMessage =
      error && typeof error.message === 'string'
        ? error.message
        : 'Ocorreu um erro desconhecido na comunicação com o backend.';
    throw new Error(detailedMessage);
  }
};
