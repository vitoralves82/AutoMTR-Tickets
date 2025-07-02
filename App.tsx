import React, { useState, useCallback, useEffect } from 'react';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as XLSX from 'xlsx';
import ImageUpload from './components/ImageUpload';
import DataTable from './components/DataTable';
import Spinner from './components/Spinner';
import Alert from './components/Alert';
import AppHeader from './components/AppHeader';
import ImageEditor from './components/ImageEditor';
import { FullExtractedData, MMRHeader, MMRWasteItem } from './types';
import { GEMINI_MODEL_NAME, GEMINI_API_PROMPT_HEADER, GEMINI_API_PROMPT_ITEMS } from './constants';

interface CurrentImageState {
  file: File;
  base64: string;
  mimeType: string;
}

const LOCAL_STORAGE_KEY_MMR_COUNT = 'totalProcessedMmrsAutoMMR';
const LOCAL_STORAGE_KEY_MIN_SAVED = 'totalMinutesSavedAutoMMR';
const MINUTES_PER_PAGE = 15;

const formatMinutes = (total: number): string => {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours} ${hours === 1 ? 'hora' : 'horas'}`);
  if (minutes > 0 || hours === 0) parts.push(`${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`);
  return parts.join(' e ');
};

const rotateImage = (base64: string, mimeType: string, degrees: number): Promise<{ rotatedBase64: string; newMimeType: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `data:${mimeType};base64,${base64}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Contexto do canvas não disponível'));

      const w = img.width;
      const h = img.height;
      const rad = (degrees * Math.PI) / 180;

      if (degrees === 90 || degrees === 270) {
        canvas.width = h;
        canvas.height = w;
      } else {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rad);
      ctx.drawImage(img, -w / 2, -h / 2);
      ctx.restore();

      const newMimeType = 'image/jpeg';
      const dataUrl = canvas.toDataURL(newMimeType);
      resolve({ rotatedBase64: dataUrl.split(',')[1], newMimeType });
    };
    img.onerror = err => reject(new Error(String(err)));
  });
};

const App: React.FC = () => {
  const [currentImage, setCurrentImage] = useState<CurrentImageState | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [extractedData, setExtractedData] = useState<FullExtractedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [processedMmrCount, setProcessedMmrCount] = useState<number>(() => parseInt(localStorage.getItem(LOCAL_STORAGE_KEY_MMR_COUNT) || '0', 10));
  const [minutesSaved, setMinutesSaved] = useState<number>(() => parseInt(localStorage.getItem(LOCAL_STORAGE_KEY_MIN_SAVED) || '0', 10));
  const [lastSaved, setLastSaved] = useState<number>(0);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_MMR_COUNT, processedMmrCount.toString());
  }, [processedMmrCount]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_MIN_SAVED, minutesSaved.toString());
  }, [minutesSaved]);

  const handleImageSelect = useCallback((file: File, base64: string, mime: string, dataUrl: string) => {
    setCurrentImage({ file, base64, mimeType: mime });
    setPreviewUrl(dataUrl);
    setExtractedData(null);
    setError(null);
    setLastSaved(0);
  }, []);

  const handleImageSave = (newBase64: string, newMimeType: string) => {
    if (!currentImage) return;
    setCurrentImage(prev => ({ ...prev!, base64: newBase64, mimeType: newMimeType }));
    setPreviewUrl(`data:${newMimeType};base64,${newBase64}`);
    setIsEditing(false);
  };

  const parseJson = <T,>(txt: string): T | null => {
    try { return JSON.parse(txt.trim()) as T; } catch { return null; }
  };

  const processImage = async () => {
    if (!currentImage) { setError('Selecione um arquivo primeiro.'); return; }
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) { setError('Configure VITE_GEMINI_API_KEY nas env vars.'); return; }

    setIsLoading(true);
    setError(null);
    setExtractedData(null);
    setLastSaved(0);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME });
      let imgData = currentImage.base64;
      let mimeType = currentImage.mimeType;

      setLoadingMessage('Verificando orientação...');
      const orientResp = await model.generateContent([
        { inlineData: { mimeType, data: imgData } },
        'Analise a orientação: upright, upside_down, rotated_cw ou rotated_ccw.'
      ]);
      const orient = orientResp.response.text().trim().toLowerCase();
      let deg = orient.includes('upside_down') ? 180 : orient.includes('rotated_cw') ? 270 : orient.includes('rotated_ccw') ? 90 : 0;
      if (deg) {
        setLoadingMessage(`Corrigindo orientação...`);
        const rot = await rotateImage(imgData, mimeType, deg);
        imgData = rot.rotatedBase64;
        mimeType = rot.newMimeType;
      }

      const imagePart = { inlineData: { mimeType, data: imgData } };

      setLoadingMessage('Extraindo cabeçalho...');
      const headerResp = await model.generateContent([imagePart, GEMINI_API_PROMPT_HEADER]);
      const header = parseJson<MMRHeader>(headerResp.response.text());
      if (!header) throw new Error('Falha no parse do cabeçalho');

      setLoadingMessage('Extraindo itens...');
      const itemsResp = await model.generateContent([imagePart, GEMINI_API_PROMPT_ITEMS]);
      const items = parseJson<MMRWasteItem[]>(itemsResp.response.text());
      if (!items) throw new Error('Falha no parse dos itens');

      setExtractedData({ header, items });
      setProcessedMmrCount(c => c + 1);
      setMinutesSaved(m => m + MINUTES_PER_PAGE);
      setLastSaved(MINUTES_PER_PAGE);
    } catch (err: any) {
      console.error(err);
      setError(err.message || String(err));
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
    }
  };

  const exportToExcel = () => {
    if (!extractedData) { setError('Não há dados para exportar.'); return; }
    const { header, items } = extractedData;
    const dataRows = items.map(item => ({
      Atividade: header.atividade || 'N/A',
      Projeto: header.bacia || 'N/A',
      Poco: header.poco || 'N/A',
      'Tipo de Resíduo': item.tipoDeResiduo || 'N/A',
      Descrição: item.descricao || 'N/A'
    }));
    const ws = XLSX.utils.json_to_sheet(dataRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados MMR');
    XLSX.writeFile(wb, `autommr_export_${Date.now()}.xlsx`);
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col items-center p-4 selection:bg-teal-600 selection:text-white">
      <AppHeader />
      <main className="container mx-auto w-full max-w-5xl bg-slate-800 bg-opacity-80 shadow-2xl rounded-lg p-6 md:p-8 mt-6">
        <ImageUpload onImageSelect={handleImageSelect} apiProcessing={isLoading} previewUrl={previewUrl} />
        {currentImage && (
          <div className="mt-4 text-center flex flex-col sm:flex-row justify-center items-center gap-4">
            <p className="text-sm text-slate-400">Arquivo: {currentImage.file.name}</p>
            {!isLoading && (
              <button onClick={() => setIsEditing(true)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg shadow-md" aria-label="Editar imagem">Editar Imagem</button>
            )}
          </div>
        )}
        <div className="mt-6 text-center">
          <button onClick={processImage} disabled={!currentImage || isLoading} className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 text-white font-bold py-3 px-8 rounded-lg shadow-md">{isLoading ? 'Processando...' : 'Extrair Dados do MMR'}</button>
        </div>
        {isLoading && <Spinner message={loadingMessage} />}
        {error && <Alert message={error} type="error" />}        
        {extractedData && !isLoading && !error && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-slate-50 flex-grow">Dados Extraídos do MMR</h2>
              <button onClick={exportToExcel} className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-md">Exportar para Excel</button>
            </div>
            <DataTable data={extractedData} />
          </div>
        )}
        {lastSaved > 0 && !isLoading && !error && (
          <div className="mt-6 p-4 bg-slate-700 rounded-md shadow text-center">
            <p className="text-lg text-teal-300 font-medium">Você acaba de economizar <strong>{formatMinutes(lastSaved)}</strong> da sua vida. Parabéns!</p>
            <p className="text-sm text-slate-400 mt-1">Total acumulado: <strong>{formatMinutes(minutesSaved)}</strong></p>
          </div>
        )}
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
