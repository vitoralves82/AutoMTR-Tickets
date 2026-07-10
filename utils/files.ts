import { ALLOWED_MIME_TYPES, type ProcessedImageData } from '../types';

export const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

export const isAcceptedType = (type: string): boolean =>
  (ALLOWED_MIME_TYPES as readonly string[]).includes(type);

// O Gemini processa PDFs nativamente: cada arquivo é lido para base64 e enviado
// como está (application/pdf ou imagem), sem rasterização no navegador.
export const processFile = async (file: File): Promise<ProcessedImageData> => {
  const dataUrl = await fileToDataUrl(file);
  return {
    base64: dataUrl.split(',')[1],
    mimeType: file.type as ProcessedImageData['mimeType'],
    fileName: file.name,
  };
};

export const base64ToBytes = (base64: string): number => Math.floor((base64.length * 3) / 4);

export const formatFileSize = (base64: string): string => {
  const bytes = base64ToBytes(base64);
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
