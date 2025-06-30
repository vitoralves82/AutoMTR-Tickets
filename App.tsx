
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
import { GEMINI_API_KEY } from './constants';

async function chamaGemini(prompt: string) {
  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateText?key=${GEMINI_API_KEY}`;

  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt })
  });

  return await r.json();
}

interface CurrentImageState {
  file: File; // Original uploaded file (for name, etc.)
  base64: string; // Base64 data (could be original image or converted PDF)
  mimeType: string; // MIME type of the base64 data to be sent to API
}


const LOCAL_STORAGE_KEY_MMR_COUNT = 'totalProcessedMmrsAutoMMR';

const App: React.FC = () => {
  const [currentImage, setCurrentImage] = useState<CurrentImageState | null>(null);
  const [extractedData, setExtractedData] = useState<FullExtractedData | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [processedMmrCount, setProcessedMmrCount] = useState<number>(() => {
    const storedCount = localStorage.getItem(LOCAL_STORAGE_KEY_MMR_COUNT);
    return storedCount ? parseInt(storedCount, 10) : 0;
  });

  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY_MMR_COUNT, processedMmrCount.toString());
  }, [processedMmrCount]);

  const handleImageSelect = useCallback((originalFile: File, base64Data: string, mimeTypeForProcessing: string) => {
    setCurrentImage({ file: originalFile, base64: base64Data, mimeType: mimeTypeForProcessing });
    setExtractedData(null); // Clear previous results
    setError(null);
  }, []);

  const parseJsonResponse = <T,>(jsonString: string, isArrayExpected: boolean = false): T | null => {
    let cleanJsonString = jsonString.trim();
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = cleanJsonString.match(fenceRegex);
    if (match && match[1]) {
      cleanJsonString = match[1].trim();
    }
    
    try {
      return JSON.parse(cleanJsonString) as T;
    } catch (initialError) {
      console.warn("Initial JSON.parse failed:", initialError, "Attempting recovery for string (first 300 chars):", cleanJsonString.substring(0, 300) + "...");

      if (isArrayExpected) {
        const recoveredObjects: any[] = [];
        // Regex to find substrings that look like JSON objects.
        // It matches from an opening brace '{' to a closing brace '}' using a non-greedy match for the content.
        const objectRegex = /\{[\s\S]*?\}/g;
        const potentialObjectStrings = cleanJsonString.match(objectRegex);

        if (potentialObjectStrings) {
          for (const objStr of potentialObjectStrings) {
            try {
              recoveredObjects.push(JSON.parse(objStr));
            } catch (e) {
              console.warn(`JSON Recovery: Could not parse suspected object: ${objStr.substring(0,100)}...`, e);
            }
          }
        }

        if (recoveredObjects.length > 0) {
          console.log(`JSON Recovery: Successfully parsed ${recoveredObjects.length} individual objects into an array.`);
          return recoveredObjects as T; // T is expected to be SomeType[]
        } else {
          console.warn("JSON Recovery for array: No valid objects found after attempting recovery.");
        }
      }

      console.error("Failed to parse JSON and recovery failed or was not applicable:", initialError, "Original string (first 300 chars):", jsonString.substring(0, 300));
      setError(`Falha ao analisar a resposta JSON do modelo. Verifique o console para detalhes. Resposta (início): ${jsonString.substring(0,100)}...`);
      return null;
    }
  };
  
  const processImage = async () => {
    if (!currentImage) {
      setError("Por favor, selecione um arquivo primeiro.");
      return;
    }
    if (!process.env.API_KEY) {
      setError("Chave de API não configurada. Verifique as variáveis de ambiente.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtractedData(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const imagePart = {
        inlineData: {
          mimeType: currentImage.mimeType,
          data: currentImage.base64,
        },
      };

      // Extract Header
      const headerResponse = await ai.models.generateContent({
        model: GEMINI_MODEL_NAME,
        contents: { parts: [imagePart, { text: GEMINI_API_PROMPT_HEADER }] },
        config: { responseMimeType: "application/json" }
      });
      const headerText = headerResponse.text;
      const parsedHeader = parseJsonResponse<MMRHeader>(headerText, false); // isArrayExpected is false

      if (!parsedHeader) {
        setIsLoading(false);
        // setError would have been called by parseJsonResponse if parsing failed critically
        return;
      }
      
      // Extract Items
      const itemsResponse = await ai.models.generateContent({
        model: GEMINI_MODEL_NAME,
        contents: { parts: [imagePart, { text: GEMINI_API_PROMPT_ITEMS }] },
        config: { responseMimeType: "application/json" }
      });
      const itemsText = itemsResponse.text;
      const parsedItems = parseJsonResponse<MMRWasteItem[]>(itemsText, true); // isArrayExpected is true

      if (!parsedItems) {
        setIsLoading(false);
        // setError would have been called by parseJsonResponse if parsing failed critically
        return;
      }
      
      setExtractedData({ header: parsedHeader, items: parsedItems });
      setProcessedMmrCount(prevCount => prevCount + 1); 

    } catch (err) {
      console.error("Erro ao processar imagem com Gemini API:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Erro ao se comunicar com a API Gemini: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToExcel = () => {
    if (!extractedData || !extractedData.header || !extractedData.items) {
      setError("Não há dados para exportar.");
      return;
    }

    const { header, items } = extractedData;

    const dataForExport = items.map(item => ({
      "Atividade": header.atividade ?? 'N/A',
      "Bacia": "N/A", // Column "Bacia" is now "N/A"
      "Projeto": header.bacia ?? 'N/A', // Column "Projeto" now gets data from header.bacia
      "Poço": header.poco ?? 'N/A',
      "Gerador": header.gerador ?? 'N/A',
      "Embarcação": header.transportador ?? 'N/A', // Mapping Transportador to Embarcação
      "Base de Apoio": header.baseDeApoio ?? 'N/A',
      "MMR/MRB/FCDR": header.mmrNo ?? 'N/A', // Mapping MMR N°
      "Data MMR": header.data ?? 'N/A',
      "Item": item.item ?? 'N/A',
      "Tipo de Resíduo": item.tipoDeResiduo ?? 'N/A',
      "Descrição": item.descricao ?? 'N/A',
      "Acondicionamento": item.acondicionamento ?? 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados MMR");

    // Generate filename with timestamp
    const date = new Date();
    const timestamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}${date.getSeconds().toString().padStart(2, '0')}`;
    XLSX.writeFile(workbook, `autommr_export_${timestamp}.xlsx`);
  };


  return (
    <div className="min-h-screen text-slate-100 flex flex-col items-center p-4 selection:bg-teal-600 selection:text-white">
      <AppHeader />
      <main className="container mx-auto w-full max-w-5xl bg-slate-800 bg-opacity-80 shadow-2xl rounded-lg p-6 md:p-8 mt-6">
        <ImageUpload onImageSelect={handleImageSelect} apiProcessing={isLoading} />
        
        {currentImage && (
          <p className="text-sm text-slate-400 mt-2 text-center">Arquivo selecionado: {currentImage.file.name}</p>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={processImage}
            disabled={!currentImage || isLoading}
            className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 text-white font-bold py-3 px-8 rounded-lg shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-opacity-75"
            aria-label="Extrair dados do Manifesto Marítimo de Resíduos"
          >
            {isLoading ? 'Processando...' : 'Extrair Dados do MMR'}
          </button>
        </div>

        {isLoading && <Spinner />}
        {error && <Alert message={error} type="error" />}
        
        {extractedData && !isLoading && !error && (
          <div className="mt-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-semibold text-slate-50 text-center flex-grow">Dados Extraídos do MMR</h2>
              <button
                onClick={exportToExcel}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-green-400 focus:ring-opacity-75"
                aria-label="Exportar dados para Excel"
              >
                Exportar para Excel
              </button>
            </div>
            <DataTable data={extractedData} />
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
