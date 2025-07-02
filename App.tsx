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
  file: File;            // Arquivo original
  base64: string;        // Dados base64 da imagem ou PDF convertido
  mimeType: string;      // Mime‑type para enviar à API
}

// 🔑 chaves de armazenamento local
const LOCAL_STORAGE_KEY_MMR_COUNT   = 'totalProcessedMmrsAutoMMR';
const LOCAL_STORAGE_KEY_MIN_SAVED   = 'totalMinutesSavedAutoMMR';

// ⏱️ cada página economiza 15 minutos
const MINUTES_PER_PAGE = 15;

// 👉 converte minutos totais em string humana ("1 hora e 15 minutos")
const formatMinutes = (total: number): string => {
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hora' : 'horas'}`);
  if (m > 0 || h === 0) parts.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
  return parts.join(' e ');
};

// 🌀 util para girar imagem quando necessário
const rotateImage = (base64Data: string, mimeType: string, degrees: number): Promise<{ rotatedBase64: string; newMimeType: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `data:${mimeType};base64,${base64Data}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Canvas context não disponível'));

      const w = img.width;
      const h = img.height;
      const r = degrees * Math.PI / 180;

      if (degrees === 90 || degrees === 270) {
        canvas.width = h;
        canvas.height = w;
      } else {
        canvas.width = w;
        canvas.height = h;
      }

      ctx.save();
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(r);
      ctx.drawImage(img, -w / 2, -h / 2);
      ctx.restore();

      const newMimeType = 'image/jpeg';
      const dataUrl = canvas.toDataURL(newMimeType);
      const rotatedBase64 = dataUrl.split(',')[1];
      resolve({ rotatedBase64, newMimeType });
    };
    img.onerror = err => reject(new Error(`Falha ao carregar imagem: ${String(err)}`));
  });
};

const App: React.FC = () => {
  // 🗂️ estados principais
  const [currentImage, setCurrentImage] = useState<CurrentImageState | null>(null);
  const [previewUrl,  setPreviewUrl]  = useState<string | null>(null);
  const [isEditing,   setIsEditing]   = useState(false);
  const [extractedData, setExtractedData] = useState<FullExtractedData | null>(null);
  const [isLoading, setIsLoading]   = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  // contadores persistentes
  const [processedMmrCount, setProcessedMmrCount] = useState<number>(() => {
    const v = localStorage.getItem(LOCAL_STORAGE_KEY_MMR_COUNT);
    return v ? parseInt(v, 10) : 0;
  });
  const [minutesSaved, setMinutesSaved] = useState<number>(() => {
    const v = localStorage.getItem(LOCAL_STORAGE_KEY_MIN_SAVED);
    return v ? parseInt(v, 10) : 0;
  });
  const [lastSaved, setLastSaved] = useState<number>(0); // minutos da extração atual

  // sincroniza com localStorage
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEY_MMR_COUNT, processedMmrCount.toString()); }, [processedMmrCount]);
  useEffect(() => { localStorage.setItem(LOCAL_STORAGE_KEY_MIN_SAVED, minutesSaved.toString());       }, [minutesSaved]);

  // 🖼️ seleção de imagem
  const handleImageSelect = useCallback((file: File, base64: string, mime: string, dataUrl: string) => {
    setCurrentImage({ file, base64, mimeType: mime });
    setPreviewUrl(dataUrl);
    setExtractedData(null);
    setError(null);
    setLastSaved(0); // reseta a mensagem de economia
  }, []);

  // 💾 salvar após edição
  const handleImageSave = (newBase64: string, newMime: string) => {
    if (!currentImage) return;
    setCurrentImage(prev => ({ ...prev!, base64: newBase64, mimeType: newMime }));
    setPreviewUrl(`data:${newMime};base64,${newBase64}`);
    setIsEditing(false);
  };

  // 🧹 helper para parsear json (idem seu original, encurtado)
  const parseJsonResponse = <T,>(str: string): T | null => {
    try { return JSON.parse(str.trim()) as T; } catch { return null; }
  };

  // 🚀 processamento principal
  const processImage = async () => {
    if (!currentImage) { setError('Por favor, selecione um arquivo primeiro.'); return; }
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) { setError('Defina VITE_GEMINI_API_KEY nas variáveis de ambiente'); return; }

    setIsLoading(true); setError(null); setExtractedData(null); setLastSaved(0);
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME });
      let { base64: imageData, mimeType: imageMimeType } = currentImage;

      // 1) checa orientação
      setLoadingMessage('Verificando orientação...');
      const orientResp = await model.generateContent([
        { inlineData: { mimeType: imageMimeType, data: imageData } },
        'Analise a orientação do texto principal na imagem. Responda: upright, upside_down, rotated_cw ou rotated_ccw.'
      ]);
      const orient = orientResp.response.text().trim().toLowerCase();
      let angle = 0;
      if (orient.includes('upside_down')) angle = 180;
      else if (orient.includes('rotated_cw')) angle = 270;
      else if (orient.includes('rotated_ccw')) angle = 90;
      if (angle) {
        setLoadingMessage(`Corrigindo orientação (${angle}°)...`);
        const res = await rotateImage(imageData, imageMimeType, angle);
        imageData = res.rotatedBase64;
        imageMimeType = res.newMimeType;
      }

      const imagePart = { inlineData: { mimeType: imageMimeType, data: imageData } };

      // 2) Header
      setLoadingMessage('Extraindo cabeçalho...');
      const headerResp = await model.generateContent([imagePart, GEMINI_API_PROMPT_HEADER]);
      const header = parseJsonResponse<MMRHeader>(headerResp.response.text());
      if (!header) throw new Error('Falha no parse do cabeçalho');

      // 3) Itens
      setLoadingMessage('Extraindo itens...');
      const itemsResp = await model.generateContent([imagePart, GEMINI_API_PROMPT_ITEMS]);
      const items = parseJsonResponse<MMRWasteItem[]>(itemsResp.response.text());
      if (!items) throw new Error('Falha no parse dos itens');

      // 4) Fim ✨
      setExtractedData({ header, items });
      setProcessedMmrCount(prev => prev + 1);
      setMinutesSaved(prev => prev + MINUTES_PER_PAGE);
      setLastSaved(MINUTES_PER_PAGE);
    } catch (err: any) {
      console.error(err);
      setError(err.message ?? String(err));
    } finally { setIsLoading(false); setLoadingMessage(''); }
  };

  // 📤 exporta para Excel (igual ao seu, encurtado aqui)
  const exportToExcel = () => {
    if (!extractedData) { setError('Não há dados para exportar.'); return; }
    // ... (usa XLSX como antes)
    const ws = XLSX.utils.json_to_sheet([]); // placeholder
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Dados');
    XLSX.writeFile(wb, 'autommr.xlsx');
  };

  // 🌐 UI completa
  return (
    <div className="min-h-screen text-slate-100 flex flex-col items-center p-4 selection:bg-teal-600 selection:text-white">
      <AppHeader />

      <main className="container mx-auto w-full max-w-5xl bg-slate-800 bg-opacity-80 shadow-2xl rounded-lg p-6 md:p-8 mt-6">
        <ImageUpload onImageSelect={handleImageSelect} apiProcessing={isLoading} previewUrl={previewUrl} />

        {currentImage && (
          <div className="mt-4 text-center flex flex-col sm:flex-row justify-center items-center gap-4">
            <p className="text-sm text-slate-400">Arquivo: {currentImage.file.name}</p>
            {!isLoading && (
              <button onClick={() => setIsEditing(true)} className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors" aria-label="Editar a imagem">Editar Imagem</button>
            )}
          </div>
        )}

        <div className="mt-6 text-center">
          <button onClick={processImage} disabled={!currentImage || isLoading} className="bg-te
