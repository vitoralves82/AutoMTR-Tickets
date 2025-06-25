
export interface MMRHeader {
  mmrNo: string | null;
  data: string | null;
  gerador: string | null;
  transportador: string | null;
  baseDeApoio: string | null;
  atividade: string | null;
  bacia: string | null;
  poco: string | null;
  projeto: string | null; // Added field for "Projeto"
}

export interface MMRWasteItem {
  item: string | null;
  codigo: string | null;
  tipoDeResiduo: string | null;
  descricao: string | null;
  acondicionamento: string | null;
  quantidade: number | string | null; // Keep as string initially from OCR, convert if possible
  unidade: string | null;
  pesoKg: number | string | null; // Keep as string initially from OCR, convert if possible
  classeNbr: string | null;
  mtr: string | null;
}

export interface FullExtractedData {
  header: MMRHeader;
  items: MMRWasteItem[];
}

// Props for components
export interface ImageUploadProps {
  onImageSelect: (originalFile: File, base64Data: string, mimeTypeForProcessing: string) => void;
  apiProcessing: boolean;
}

export interface DataTableProps {
  data: FullExtractedData;
}

export interface AlertProps {
  message: string;
  type: 'error' | 'info' | 'success';
}