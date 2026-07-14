import { useCallback, useState } from 'react';
import { analyzeImagesWithGemini } from '../services/geminiService';
import { parseGeminiResponse } from '../services/responseParser';
import { base64ToBytes, isAcceptedType, processFile } from '../utils/files';
import {
  MAX_FILES,
  MAX_PAYLOAD_BYTES,
  type DocumentType,
  type GeminiJsonResponse,
  type ProcessedImageData,
} from '../types';

const TIME_SAVED_KEY = 'totalTimeSavedMinutes';
const MINUTES_SAVED_PER_PDF = 20;

export interface DocumentAnalysis {
  documentType: DocumentType;
  selectedFiles: File[];
  processedFiles: ProcessedImageData[];
  rawApiResponse: string | null;
  parsedApiResponse: GeminiJsonResponse | null;
  isProcessingFiles: boolean;
  processingMessage: string | null;
  isLoadingApi: boolean;
  errorMessage: string | null;
  totalTimeSaved: number;
  setDocumentType: (type: DocumentType) => void;
  handleFilesSelected: (files: FileList | null) => Promise<void>;
  analyze: () => Promise<void>;
}

export const useDocumentAnalysis = (): DocumentAnalysis => {
  const [documentType, setDocumentTypeState] = useState<DocumentType>('mtr');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processedFiles, setProcessedFiles] = useState<ProcessedImageData[]>([]);
  const [rawApiResponse, setRawApiResponse] = useState<string | null>(null);
  const [parsedApiResponse, setParsedApiResponse] = useState<GeminiJsonResponse | null>(null);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [totalTimeSaved, setTotalTimeSaved] = useState(() => {
    try {
      const saved = localStorage.getItem(TIME_SAVED_KEY);
      if (saved) {
        const minutes = parseInt(saved, 10);
        if (!isNaN(minutes)) return minutes;
      }
    } catch (error) {
      console.error('Falha ao ler o tempo economizado do localStorage', error);
    }
    return 0;
  });

  const resetResults = () => {
    setErrorMessage(null);
    setRawApiResponse(null);
    setParsedApiResponse(null);
    setProcessedFiles([]);
    setProcessingMessage(null);
    setSelectedFiles([]);
  };

  const setDocumentType = useCallback((type: DocumentType) => {
    setDocumentTypeState(type);
    resetResults();
  }, []);

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    resetResults();
    if (!files || files.length === 0) return;

    const filesArray = Array.from(files);
    if (filesArray.length > MAX_FILES) {
      setErrorMessage(`Máximo de ${MAX_FILES} arquivos por análise. Selecione menos arquivos.`);
      return;
    }

    setSelectedFiles(filesArray);
    setIsProcessingFiles(true);

    const processed: ProcessedImageData[] = [];
    const errors: string[] = [];

    for (const file of filesArray) {
      try {
        if (isAcceptedType(file.type)) {
          setProcessingMessage(`Processando: ${file.name}...`);
          processed.push(await processFile(file));
        } else {
          errors.push(
            `Arquivo não suportado ignorado: ${file.name} (aceitos: PDF, JPG, PNG, WEBP)`,
          );
        }
      } catch (error: any) {
        errors.push(`Falha ao processar ${file.name}: ${error?.message || 'Erro desconhecido'}`);
      }
    }

    setProcessedFiles(processed);
    if (errors.length > 0) setErrorMessage(errors.join('\n'));
    if (processed.length > 0) {
      setProcessingMessage(
        `Processado(s) ${processed.length} de ${filesArray.length} arquivo(s). Pronto para análise.`,
      );
    } else {
      setProcessingMessage(null);
    }
    setIsProcessingFiles(false);
  }, []);

  const registerTimeSaved = useCallback(() => {
    const pdfCount = selectedFiles.filter((f) => f.type === 'application/pdf').length;
    if (pdfCount === 0) return;
    setTotalTimeSaved((prev) => {
      const next = prev + pdfCount * MINUTES_SAVED_PER_PDF;
      try {
        localStorage.setItem(TIME_SAVED_KEY, String(next));
      } catch (error) {
        console.error('Falha ao gravar o tempo economizado no localStorage', error);
      }
      return next;
    });
  }, [selectedFiles]);

  const analyze = useCallback(async () => {
    if (processedFiles.length === 0) {
      setErrorMessage('Por favor, selecione e processe um arquivo primeiro.');
      return;
    }

    const payloadBytes = processedFiles.reduce((sum, d) => sum + base64ToBytes(d.base64), 0);
    if (payloadBytes > MAX_PAYLOAD_BYTES) {
      setErrorMessage(
        'Os arquivos são grandes demais para envio. Tente enviar menos arquivos ou arquivos menores.',
      );
      return;
    }

    setIsLoadingApi(true);
    setErrorMessage(null);
    setRawApiResponse(null);
    setParsedApiResponse(null);

    try {
      const result = await analyzeImagesWithGemini(processedFiles, documentType);
      setRawApiResponse(result);

      const parsed = parseGeminiResponse(result);
      if (parsed.ok) {
        setParsedApiResponse(parsed.data);
        registerTimeSaved();
      } else {
        setParsedApiResponse(null);
        setErrorMessage(parsed.error);
      }
    } catch (error: any) {
      console.error('Erro ao analisar o(s) documento(s):', error);
      let message = 'Falha ao analisar o documento. Verifique o console para mais detalhes.';
      if (error?.message?.includes('API_KEY') || error?.message?.includes('chave de API')) {
        message = 'Erro de configuração: a chave da API está ausente ou inválida no servidor.';
      } else if (typeof error?.message === 'string') {
        message = error.message;
      }
      setErrorMessage(message);
      setRawApiResponse(null);
      setParsedApiResponse(null);
    } finally {
      setIsLoadingApi(false);
    }
  }, [processedFiles, documentType, registerTimeSaved]);

  return {
    documentType,
    selectedFiles,
    processedFiles,
    rawApiResponse,
    parsedApiResponse,
    isProcessingFiles,
    processingMessage,
    isLoadingApi,
    errorMessage,
    totalTimeSaved,
    setDocumentType,
    handleFilesSelected,
    analyze,
  };
};
