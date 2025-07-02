Olá\! Já fiz as alterações no `App.tsx` do seu branch `AutoMMR` para incluir a funcionalidade de contagem de tempo economizado, seguindo a mesma lógica que aplicamos ao `AutoMTR`.

Cada Manifesto Marítimo de Resíduos (MMR) processado com sucesso agora soma 15 minutos ao contador de tempo total, que fica salvo no seu navegador. A mensagem aparecerá discretamente no rodapé da página.

Aproveito para responder sua outra pergunta.

### Como compartilhar o código de um branch específico?

A forma mais garantida de compartilhar o código de um branch específico (como `AutoMMR` ou `main`) é usando o Git, o sistema de controle de versão que o GitHub utiliza. Antes de exportar ou zipar a pasta do seu projeto, você pode usar um simples comando no seu terminal para trocar de branch:

1.  **Abra o terminal** na pasta do seu projeto.
2.  **Use o comando `git checkout`** seguido do nome do branch que você quer acessar. Por exemplo:
    ```bash
    # Para mudar para o branch AutoMMR
    git checkout AutoMMR
    ```
    Ou para voltar ao branch principal:
    ```bash
    # O nome pode ser 'main' ou 'master', dependendo do seu projeto
    git checkout main
    ```
3.  Após rodar o comando, os arquivos na sua pasta serão automaticamente atualizados para a versão daquele branch. Aí é só me enviar os arquivos que deseja modificar.

-----

### Código completo para `App.tsx` do branch `AutoMMR`

Aqui está o código modificado para o seu arquivo `App.tsx`. Basta substituir o conteúdo do arquivo atual por este.

````tsx
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
  file: File; // Original uploaded file (for name, etc.)
  base64: string; // Base64 data (could be original image or converted PDF)
  mimeType: string; // MIME type of the base64 data to be sent to API
}

const LOCAL_STORAGE_KEY_MMR_COUNT = 'totalProcessedMmrsAutoMMR';
const LOCAL_STORAGE_KEY_TIME_SAVED = 'totalTimeSavedMinutesAutoMMR';

const rotateImage = (base64Data: string, mimeType: string, degrees: number): Promise<{ rotatedBase64: string; newMimeType: string }> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.src = `data:${mimeType};base64,${base64Data}`;
        image.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                return reject(new Error('Não foi possível obter o contexto do canvas.'));
            }

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
        image.onerror = (err) => reject(new Error(`Falha ao carregar imagem para rotação: ${String(err)}`));
    });
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
  
  const [totalTimeSaved, setTotalTimeSaved] = useState<number>(0);

  useEffect(() => {
    // Carregar dados salvos do localStorage ao iniciar
    const storedCount = localStorage.getItem(LOCAL_STORAGE_KEY_MMR_COUNT);
    if (storedCount) {
        setProcessedMmrCount(parseInt(storedCount, 10) || 0);
    }
    const savedMinutes = localStorage.getItem(LOCAL_STORAGE_KEY_TIME_SAVED);
    if (savedMinutes) {
        setTotalTimeSaved(parseInt(savedMinutes, 10) || 0);
    }
  }, []);

  const handleImageSelect = useCallback((originalFile: File, base64Data: string, mimeTypeForProcessing: string, dataUrl: string) => {
    setCurrentImage({ file: originalFile, base64: base64Data, mimeType: mimeTypeForProcessing });
    setPreviewUrl(dataUrl);
    setExtractedData(null); // Clear previous results
    setError(null);
  }, []);

  const handleImageSave = (newBase64: string, newMimeType: string) => {
    if (!currentImage) return;

    const newDataUrl = `data:${newMimeType};base64,${newBase64}`;
    
    setCurrentImage(prev => ({
        ...prev!,
        base64: newBase64,
        mimeType: newMimeType,
    }));
    setPreviewUrl(newDataUrl);
    setIsEditing(false);
  };

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

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setError("A chave de API (VITE_GEMINI_API_KEY) não está configurada. Adicione-a às variáveis de ambiente do seu projeto.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtractedData(null);

    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      
      let imageData = currentImage.base64;
      let imageMimeType = currentImage.mimeType;

      setLoadingMessage('Verificando a orientação da imagem...');
      const orientationPrompt = `Analise a orientação do texto principal na imagem. Responda com uma única palavra: "upright" para texto normal, "upside_down" para de cabeça para baixo, "rotated_cw" para girado 90 graus no sentido horário, ou "rotated_ccw" para girado 90 graus no sentido anti-horário.`;
      
      const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_NAME });
      
      const orientationResponse = await model.generateContent([
        { inlineData: { mimeType: imageMimeType, data: imageData } },
        orientationPrompt
      ]);
      
      const orientation = orientationResponse.response.text().trim().toLowerCase();
      let rotationAngle = 0;
      if (orientation.includes('upside_down')) {
        rotationAngle = 180;
      } else if (orientation.includes('rotated_cw')) {
        rotationAngle = 270;
      } else if (orientation.includes('rotated_ccw')) {
        rotationAngle = 90;
      }
      
      if (rotationAngle !== 0) {
        setLoadingMessage(`Corrigindo orientação da imagem (${rotationAngle}°)...`);
        const { rotatedBase64, newMimeType } = await rotateImage(imageData, imageMimeType, rotationAngle);
        imageData = rotatedBase64;
        imageMimeType = newMimeType;
      }

      const imagePart = {
        inlineData: {
          mimeType: imageMimeType,
          data: imageData,
        },
      };

      setLoadingMessage('Extraindo dados do cabeçalho...');
      const headerResponse = await model.generateContent([
        imagePart,
        GEMINI_API_PROMPT_HEADER
      ]);
      
      const headerText = headerResponse.response.text();
      const parsedHeader = parseJsonResponse<MMRHeader>(headerText, false);

      if (!parsedHeader) {
        setIsLoading(false);
        return;
      }
      
      setLoadingMessage('Extraindo itens da tabela...');
      const itemsResponse = await model.generateContent([
        imagePart,
        GEMINI_API_PROMPT_ITEMS
      ]);
      
      const itemsText = itemsResponse.response.text();
      const parsedItems = parseJsonResponse<MMRWasteItem[]>(itemsText, true);

      if (!parsedItems) {
        setIsLoading(false);
        return;
      }
      
      setLoadingMessage('Finalizando...');
      setExtractedData({ header: parsedHeader, items: parsedItems });
      
      const newMmrCount = processedMmrCount + 1;
      setProcessedMmrCount(newMmrCount);
      localStorage.setItem(LOCAL_STORAGE_KEY_MMR_COUNT, String(newMmrCount));
      
      const timeSavedThisSession = 15;
      const newTotalTimeSaved = totalTimeSaved + timeSavedThisSession;
      setTotalTimeSaved(newTotalTimeSaved);
      localStorage.setItem(LOCAL_STORAGE_KEY_TIME_SAVED, String(newTotalTimeSaved));

    } catch (err) {
      console.error("Erro ao processar imagem com Gemini API:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Erro ao se comunicar com a API Gemini: ${errorMessage}`);
    } finally {
      setIsLoading(false);
      setLoadingMessage('');
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
      "Bacia": "N/A",
      "Projeto": header.bacia ?? 'N/A',
      "Poço": header.poco ?? 'N/A',
      "Gerador": header.gerador ?? 'N/A',
      "Embarcação": header.transportador ?? 'N/A',
      "Base de Apoio": header.baseDeApoio ?? 'N/A',
      "MMR/MRB/FCDR": header.mmrNo ?? 'N/A',
      "Data MMR": header.data ?? 'N/A',
      "Item": item.item ?? 'N/A',
      "Tipo de Resíduo": item.tipoDeResiduo ?? 'N/A',
      "Descrição": item.descricao ?? 'N/A',
      "Acondicionamento": item.acondicionamento ?? 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataForExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Dados MMR");

    const date = new Date();
    const timestamp = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}_${date.getHours().toString().padStart(2, '0')}${date.getMinutes().toString().padStart(2, '0')}${date.getSeconds().toString().padStart(2, '0')}`;
    XLSX.writeFile(workbook, `autommr_export_${timestamp}.xlsx`);
  };

  const formatTimeSaved = (totalMinutes: number): string => {
    if (totalMinutes <= 0) return "";
    if (totalMinutes < 60) return `${totalMinutes} minutos`;
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    const hourText = hours > 1 ? 'horas' : 'hora';

    if (minutes === 0) {
        return `${hours} ${hourText}`;
    }
    
    return `${hours} ${hourText} e ${minutes} minutos`;
  };

  return (
    <div className="min-h-screen text-slate-100 flex flex-col items-center p-4 selection:bg-teal-600 selection:text-white">
      <AppHeader />
      <main className="container mx-auto w-full max-w-5xl bg-slate-800 bg-opacity-80 shadow-2xl rounded-lg p-6 md:p-8 mt-6">
        <ImageUpload 
          onImageSelect={handleImageSelect} 
          apiProcessing={isLoading}
          previewUrl={previewUrl}
        />
        
        {currentImage && (
          <div className="mt-4 text-center flex flex-col sm:flex-row justify-center items-center gap-4">
            <p className="text-sm text-slate-400">Arquivo: {currentImage.file.name}</p>
            {!isLoading && (
              <button
                onClick={() => setIsEditing(true)}
                className="bg-sky-600 hover:bg-sky-700 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-sky-400 focus:ring-opacity-75"
                aria-label="Editar a imagem"
              >
                Editar Imagem
              </button>
            )}
          </div>
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

        {isLoading && <Spinner message={loadingMessage} />}
        {error && <Alert message={error} type="error" />}

        {isEditing && currentImage && previewUrl && (
          <ImageEditor
            imageSrc={previewUrl}
            onClose={() => setIsEditing(false)}
            onSave={handleImageSave}
          />
        )}
        
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
  {totalTimeSaved > 0 && (
      <p className="text-sm text-slate-300">
          Você já economizou um total de {formatTimeSaved(totalTimeSaved)} da sua vida. Parabéns!
      </p>
  )}
  <p className="text-xs text-slate-500 mt-2">
    &copy; {new Date().getFullYear()} AutoMMR. Powered by Consultoria ESG - EVP.
  </p>
</footer>
    </div>
  );
};

export default App;
