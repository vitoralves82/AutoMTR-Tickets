
export interface ProcessedImageData {
  base64: string;
  mimeType: string;
  fileName: string;
  pageNumber?: number;
}

export interface ExtractedField {
  topic: string;
  answer: string;
}

export interface ExtractedSection {
  sectionTitle: string;
  fields: ExtractedField[];
}

export type GeminiJsonResponse = ExtractedSection[];
