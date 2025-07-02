import React, { useState, useCallback, useEffect } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
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
  file: File; // arquivo original
  base64: string; // dados base64 (imagem ou PDF convertido)
  mimeType: string; // mime‑type enviado à API
}

const LOCAL_STORAGE_KEY_MMR_COUNT = 'totalProcessedMmrsAutoMMR';
const LOCAL_STORAGE_KEY_MINUTES_SAVED = 'totalMinutesSavedAutoMMR';
const MINUTES_PER_PAGE = 15; // 15 min economizados por página

// 🔧 utilitário para converter minutos em string amigável
const formatMinutes = (total: number): string => {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
  if (minutes > 0 || hours === 0) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
  return parts.join(' e ');
};

// 🔄 rotação de imagem, mantive igual ao original
const rotateImage = (base64Data: string, mimeType: string, degrees: number): Promise<{ rotatedBase64: string; newMimeType: string }> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = `data:${mimeType};base64,${base64Data}`;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Não foi possível obter o contexto do canvas.'));

      const w = image.width;
      const h = image.height;
      const rads = degrees * Math.PI / 180;

      if (degrees === 90 || degrees === 270) {
        canvas.width = h;
        canvas.height = w;
      } else {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rads);
      ctx.drawImage(image, -w / 2, -h / 2);
      ctx.restore();

      const newMimeType = 'image/jpeg';
      const dataUrl = canvas.toDataURL(newMimeType);
      const rotatedBase64 = dataUrl.split(',')[1];
      resolve({ rotatedBase64, newMimeType });
    };
    image.onerror = err => reject(new Error(`Falha ao carregar imagem para rotação: ${String(err)}`));
  });
};

const App: React.FC = () => {
  // 📦 states
  const [currentImage, setCurrentImage] = useState<CurrentImageState | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [extractedData, setExtractedData] = useState<FullExtractedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [processedMmrCount, setProcessedMmrCount] = useState<number>(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY_MMR_COUNT);
    return stored ? parseInt(stored, 10) : 0;
  });

  const [minutesSaved, setMinutesSaved] = useState<number>(() => {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY_MINUTES_SAVED);
    return stored ? parseInt(stored, 10) : 0;
  });

  const [lastSavedMinutes, setLastSavedMinutes] = useState<number>(0); // minutos economizados no processamento atual

  // 🔄 persistência
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_MMR_COUNT, processedMmrCount.toString());
  }, [processedMmrCount]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_MINUTES_SAVED, minutesSaved.toString());
  }, [minutesSaved]);

  // 📥 seleção de imagem
  const handleImageSelect = useCallback((file: File, base64: string, mime: string, dataUrl: string) => {
    setCurrentImage({ file, base64, mimeType: mime });
    setPreviewUrl(dataUrl);
    setExtractedData(null);
    setError(null);
  }, []);

  // 🖼️ salvar edição
  const handleImageSave = (newBase64: string, newMimeType: string) => {
    if (!currentImage) return;
    setCurrentImage(prev => ({ ...prev!, base64: newBase64, mimeType: newMimeType }));
    setPreviewUrl(`data:${newMimeType};base64,${newBase64}`);
    setIsEditing(false);
  };

  // 🧹 limpa/recupera JSON
  const parseJsonResponse = <T,>(jsonString: string, isArrayExpected = false): T | null => {
    let clean = jsonString.trim();
    const match = clean.match(/^```(?:json)?\s*\n?(.*?)\n?\s*```$/s);
    if (match && match[1]) clean = match[1].trim();
    try {
      return JSON.parse(clean) as T;
    } catch (err) {
      // fallback omitido por brevidade (mesma lógica do seu original)
      console.error('JSON parse fail', err);
      return null;
    }
  };

  // 🚀 processamento principal (mantém sua lógica original + economia de tempo)
  const processImage = async () => {
    if (!currentImage) {
      setError('Por favor, selecione um arquivo primeiro.');
      return;
    }

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setError('A chave de API (VITE_GEMINI_API_KEY) não está configurada.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtractedData(null);
    setLastSavedMinutes(0);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME });

      // resto do seu pipeline (orientação, header, items)...
      // mantive idêntico até o ponto "Finalizando".

      // depois de extrair com sucesso:
      setExtractedData({ header: parsedHeader, items: parsedItems });
      setProcessedMmrCount(prev => prev + 1);

      const savedNow = MINUTES_PER_PAGE; // 1 página => 15 min
      setMinutesSaved(prev => prev + savedNow);
      setLastSavedMinutes(savedNow);
    } catch (err) {
      console.error('Erro no processamento:', err);
      setError(`Erro ao processar: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  // 📤 export excel (igual ao seu código)
  // ... (mantive sem alterações)

  return (
    <div className="min-h-screen text-slate-100 flex flex-col items-center p-4 selection:bg-teal-600 selection:text-white">
      <AppHeader />
      <main className="container mx-auto w-full max-w-5xl bg-slate-800 bg-opacity-80 shadow-2xl rounded-lg p-6 md:p-8 mt-6">
        <ImageUpload onImageSelect={handleImageSelect} apiProcessing={isLoading} previewUrl={previewUrl} />

        {/* botões, previews, spinner, alert, editor, tabela (código original omitido para brevidade) */}

        {lastSavedMinutes > 0 && !isLoading && !error && (
          <div className="mt-6 p-4 bg-slate-800 rounded-md shadow text-center">
            <p className="text-lg text-teal-300 font-medium">
              Você acaba de economizar <strong>{formatMinutes(lastSavedMinutes)}</strong> da sua vida. Parabéns!
            </p>
            <p className="text-sm text-slate-400 mt-1">
              Total acumulado: <strong>{formatMinutes(minutesSaved)}</strong>
            </p>
          </div>
        )}

        {/* contador geral MMR (igual) */}
        <div className="mt-10 p-6 bg-slate-700 rounded-lg shadow-md text-center">
          <h3 className="text-xl font-semibold text-slate-50 mb-2">Total de MMR's Extraídos</h3>
          <p className="text-4xl font-bold text-teal-400">{processedMmrCount}</p>
        </div>
      </main>
      <footer className="text-center py-8 text-slate-50 text-sm mt-auto">
        <p>&copy; {new Date().getFullYear()} AutoMMR. Powered by Consultoria ESG - EVP.</p>
      </footer>
    </div>
  );
};

export default App;
