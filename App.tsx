import React, { useState, useCallback, useEffect } from 'react';
import { GoogleGenAI } from "@google/genai";
import * as XLSX from 'xlsx';
import { FullExtractedData, MMRHeader, MMRWasteItem } from './types';
import { GEMINI_MODEL_NAME, GEMINI_API_PROMPT_HEADER, GEMINI_API_PROMPT_ITEMS } from './constants';
import ImageUpload from './components/ImageUpload';
import DataTable from './components/DataTable';
import Spinner from './components/Spinner';
import Alert from './components/Alert';
import AppHeader from './components/AppHeader';
import ImageEditor from './components/ImageEditor';

interface CurrentImageState {
  file: File;
  base64: string;
  mimeType: string;
}

const LOCAL_STORAGE_KEY_MMR_COUNT = 'totalProcessedMmrsAutoMMR';
// ⬇️ novo
const LOCAL_STORAGE_KEY_TIME_SAVED = 'totalTimeSavedMinutesAutoMMR';
const MINUTES_PER_PAGE = 15;

// ⬇️ utilitário simples
const formatMinutes = (totalMin: number): string => {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h} hora${h > 1 ? 's' : ''} e ${m} minuto${m > 1 ? 's' : ''}`;
  if (h > 0) return `${h} hora${h > 1 ? 's' : ''}`;
  return `${m} minuto${m > 1 ? 's' : ''}`;
};

const rotateImage = (base64Data: string, mimeType: string, degrees: number): Promise<{ rotatedBase64: string; newMimeType: string }> => {
  /* ...código inalterado... */
};

const App: React.FC = () => {
  const [currentImage, setCurrentImage] = useState<CurrentImageState | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [extractedData, setExtractedData] = useState<FullExtractedData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [loadingMessage, setLoadingMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const [processedMmrCount, setProcessedMmrCount] = useState<number>(() => {
    const storedCount = localStorage.getItem(LOCAL_STORAGE_KEY_MMR_COUNT);
    return storedCount ? parseInt(storedCount, 10) : 0;
  });

  // ⬇️ estados novos
  const [timeSavedMinutes, setTimeSavedMinutes] = useState<number>(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY_TIME_SAVED);
    return stored ? parseInt(stored, 10) : 0;
  });
  const [lastRunMinutes, setLastRunMinutes] = useState<number>(0);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_MMR_COUNT, processedMmrCount.toString());
  }, [processedMmrCount]);

  // ⬇️ salva tempo acumulado
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_TIME_SAVED, timeSavedMinutes.toString());
  }, [timeSavedMinutes]);

  const handleImageSelect = useCallback((originalFile: File, base64Data: string, mimeTypeForProcessing: string, dataUrl: string) => {
    setCurrentImage({ file: originalFile, base64: base64Data, mimeType: mimeTypeForProcessing });
    setPreviewUrl(dataUrl);
    setExtractedData(null);
    setError(null);
    setLastRunMinutes(0); // zera aviso anterior até nova extração
  }, []);

  /* ---------------- processImage mantém mesma lógica até o final ---------------- */
  const processImage = async () => {
    /* ...verificações iniciais inalteradas... */

    try {
      /* ...todo o fluxo de extração... */

      setLoadingMessage('Finalizando...');
      setExtractedData({ header: parsedHeader, items: parsedItems });
      setProcessedMmrCount(prev => prev + 1);

      // ⬇️ calcula tempo ganho (1 página = 15 min)
      const pagesProcessed = 1; // se passar numPages depois, troque aqui
      const minutesThisRun = pagesProcessed * MINUTES_PER_PAGE;
      setLastRunMinutes(minutesThisRun);
      setTimeSavedMinutes(prev => prev + minutesThisRun);

    } catch (err) {
      /* ...tratamento de erro inalterado... */
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  /* ---------------- exportToExcel permanece igual ---------------- */

  return (
    <div className="min-h-screen text-slate-100 flex flex-col items-center p-4 selection:bg-teal-600 selection:text-white">
      <AppHeader />
      <main className="container mx-auto w-full max-w-5xl bg-slate-800 bg-opacity-80 shadow-2xl rounded-lg p-6 md:p-8 mt-6">
        {/* ...ImageUpload etc... */}

        {isLoading && <Spinner message={loadingMessage} />}
        {error && <Alert message={error} type="error" />}

        {/* ...ImageEditor se necessário... */}
        
        {extractedData && !isLoading && !error && (
          <div className="mt-8">
            {/* cabeçalho da tabela + botão Exportar */}
            {/* ...DataTable... */}

            {/* ⬇️ bloco de economia de tempo desta execução */}
            {lastRunMinutes > 0 && (
              <div className="mt-6 bg-emerald-700 bg-opacity-90 p-4 rounded-lg shadow-md text-center">
                <p className="text-lg font-semibold">
                  Você acaba de economizar {formatMinutes(lastRunMinutes)} da sua vida, parabéns! 🎉
                </p>
              </div>
            )}
          </div>
        )}

        {/* contador total de MMRs - já existia */}
        <div className="mt-10 p-6 bg-slate-700 rounded-lg shadow-md text-center">
          <h3 className="text-xl font-semibold text-slate-50 mb-2">Total de MMR's Extraídos</h3>
          <p className="text-4xl font-bold text-teal-400">{processedMmrCount}</p>
        </div>

        {/* ⬇️ total de tempo salvo acumulado */}
        <div className="mt-6 p-4 bg-slate-700 rounded-lg shadow-md text-center">
          <h4 className="text-lg font-medium text-slate-50 mb-1">Tempo total economizado</h4>
          <p className="text-2xl font-bold text-emerald-400">{formatMinutes(timeSavedMinutes)}</p>
        </div>
      </main>

      <footer className="text-center py-8 text-slate-50 text-sm mt-auto">
        <p>&copy; {new Date().getFullYear()} AutoMMR. Powered by Consultoria ESG - EVP.</p>
      </footer>
    </div>
  );
};

export default App;
