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
  const h = Math.floor(total / 60);
  const m = total % 60;
  const parts: string[] = [];
  if (h > 0) parts.push(`${h} ${h === 1 ? 'hora' : 'horas'}`);
  if (m > 0 || h === 0) parts.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
  return parts.join(' e ');
};

const rotateImage = (
  base64: string,
  mimeType: string,
  deg: number,
): Promise<{ rotatedBase64: string; newMimeType: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `data:${mimeType};base64,${base64}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('Contexto do canvas indisponível'));

      const w = img.width;
      const h = img.height;
      const rad = (deg * Math.PI) / 180;

      if (deg === 90 || deg === 270) {
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
    img.onerror = err => reject(err as any);
  });
};

const App: React.FC = () => {
  // ---------- states ------------
  const [currentImage, setCurrentImage] = useState<CurrentImageState | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [extractedData, setExtractedData] = useState<FullExtractedData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [processedMmrCount, setProcessedMmrCount] = useState<number>(() => {
    const v = localStorage.getItem(LOCAL_STORAGE_KEY_MMR_COUNT);
    return v ? parseInt(v, 10) : 0;
  });
  const [minutesSaved, setMinutesSaved] = useState<number>(() => {
    const v = localStorage.getItem(LOCAL_STORAGE_KEY_MIN_SAVED);
    return v ? parseInt(v, 10) : 0;
  });
  const [lastSaved, setLastSaved] = useState<number>(0);

  // ---------- persistence --------
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_MMR_COUNT, processedMmrCount.toString());
  }, [processedMmrCount]);

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_MIN_SAVED, minutesSaved.toString());
  }, [minutesSaved]);

  // ---------- handlers -----------
  const handleImageSelect = useCallback((file: File, base64: string, mime: string, dataUrl: string) => {
    setCurrentImage({ file, base64, mimeType: mime });
    setPreviewUrl(dataUrl);
    setExtractedData(null);
    setError(null);
    setLastSaved(0);
  }, []);

  const handleImageSave = (b64: string, mime: string) => {
    if (!currentImage) return;
    setCurrentImage(prev => ({ ...prev!, base64: b64, mimeType: mime }));
    setPreviewUrl(`data:${mime};base64,${b64}`);
    setIsEditing(false);
  };

  const parseJson = <T,>(txt: string): T | null => {
    try { return JSON.parse(txt.trim()) as T; } catch { return null; }
  };

  const processImage = async () => {
    if (!currentImage) { setError('Selecione um arquivo.'); return; }
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) { setError('Defina VITE_GEMINI_API_KEY'); return; }

    setIsLoading(true);
    setError(null);
    setExtractedData(null);
    setLastSaved(0);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME });
      let { base64: imgData, mimeType } = currentImage;

      // orientação
      setLoadingMessage('Verificando orientação...');
      const orientResp = await model.generateContent([
        { inlineData: { mimeType, data: imgData } },
        'Analyze orientation: upright / upside_down / rotated_cw / rotated_ccw'
      ]);
      const orient = orientResp.response.text().trim().toLowerCase();
      let deg = 0;
      if (orient.includes('upside_down')) deg = 180;
      else if (orient.includes('rotated_cw')) deg = 270;
      else if (orient.includes('rotated_ccw')) deg = 90;
      if (deg) {
        setLoadingMessage('Corrigindo orientação...');
        const rot = await rotateImage(imgData, mimeType, deg);
        imgData = rot.rotatedBase64;
        mimeType = rot.newMimeType;
      }

      const imagePart = { inlineData: { mimeType, data: imgData } };

      // header
      setLoadingMessage('Extraindo cabeçalho...');
      const headerResp = await model.generateContent([imagePart, GEMINI_API_PROMPT_HEADER]);
      const header = parseJson<MMRHeader>(headerResp.response.text());
      if (!header) throw new Error('Falha no cabeçalho');

      // items
      setLoadingMessage('Extraindo itens...');
      const itemsResp = await model.generateContent([imagePart, GEMINI_API_PROMPT_ITEMS]);
      const items = parseJson<MMRWasteItem[]>(itemsResp.response.text());
      if (!items) throw new Error('Falha nos itens');

      setExtractedData({ header, items });
      setProcessedMmrCount(p => p + 1);
      setMinutesSaved(p => p + MINUTES_PER_PAGE);
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
    if (!extractedData) { setError('Nada para exportar.'); return; }
    const { header, items } = extractedData;
    const rows = items.map(it => ({
      Atividade: header.atividade ?? 'N/A',
      Projeto: header.bacia ?? 'N/A',
      Poço: header.poco ?? 'N/A',
      'Tipo de Resíduo': it.tipoDeResiduo ?? 'N/A',
      Descrição: it.descricao ?? 'N/A',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append
