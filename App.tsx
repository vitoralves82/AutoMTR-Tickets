import React, { useState, useCallback, useEffect } from 'react';
import { analyzeImagesWithGemini } from './services/geminiService';
import * as pdfjsLib from 'pdfjs-dist/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import * as XLSX from 'xlsx';
import type { ProcessedImageData, ExtractedField, ExtractedSection, GeminiJsonResponse } from './types';

const App: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processedImageDatas, setProcessedImageDatas] = useState<ProcessedImageData[]>([]);
  
  const userPrompt = `Your task is to analyze the provided MTR (Manifesto de Transporte de Resíduos) document images and extract all information into a single, valid JSON array.

The final output MUST be a single JSON array, where each element is an object representing a section of the document.

Each section object must have the following structure:
{
  "sectionTitle": "The title of the section, e.g., 'Identificação do Gerador'",
  "fields": [
    { "topic": "The label of the data point", "answer": "The extracted value" },
    { "topic": "Another label", "answer": "Another value" }
  ]
}

Follow these specific instructions for certain sections:

1.  **Cabeçalho do Documento**: Create a section with this title. It should include fields for "Título do Documento" and "MTR n°".

2.  **Identificação dos Resíduos**:
    - If there are multiple waste items, create a new item starting with a field like \`{"topic": "Item Nº", "answer": "1"}\`.
    - Split "Código IBAMA e Denominação" into two separate fields: one for "Código IBAMA" and one for "Denominação".
    - Also extract "Estado Físico", "Classe", "Acondicionamento", "Qtde", "Unidade", and "Tecnologia de Tratamento" for each item.

3.  **TICKETS**:
    - If any image is a weighing ticket ("Bilhete de Pesagem"), create a section with the title "TICKETS".
    - For each ticket found, add a field for its net weight. The topic should be "Peso Líquido (Ticket 1)", "Peso Líquido (Ticket 2)", and so on.

The order of sections should follow the logical flow of the document.

Here is a complete example of the expected final JSON array structure:
[
  {
    "sectionTitle": "Cabeçalho do Documento",
    "fields": [
      { "topic": "Título do Documento", "answer": "Manifesto de Transporte de Resíduos" },
      { "topic": "MTR n°", "answer": "2113238175" }
    ]
  },
  {
    "sectionTitle": "Identificação do Gerador",
    "fields": [
      { "topic": "Razão Social", "answer": "134218 - EQUINOR BRASIL ENERGIA LTDA" },
      { "topic": "Endereço", "answer": "Rua General Sampaio, n.00004" }
    ]
  },
  {
    "sectionTitle": "Identificação dos Resíduos",
    "fields": [
        { "topic": "Item Nº", "answer": "1" },
        { "topic": "Código IBAMA", "answer": "180103" },
        { "topic": "Denominação", "answer": "Resíduos de serviços de saúde" },
        { "topic": "Estado Físico", "answer": "Sólido" },
        { "topic": "Classe", "answer": "I" },
        { "topic": "Acondicionamento", "answer": "Saco Plástico" },
        { "topic": "Qtde", "answer": "100" },
        { "topic": "Unidade", "answer": "kg" },
        { "topic": "Tecnologia de Tratamento", "answer": "Incineração" }
    ]
  },
  {
    "sectionTitle": "TICKETS",
    "fields": [
      { "topic": "Peso Líquido (Ticket 1)", "answer": "5400" },
      { "topic": "Peso Líquido (Ticket 2)", "answer": "3250" }
    ]
  }
]`;
  const [rawApiResponse, setRawApiResponse] = useState<string | null>(null);
  const [parsedApiResponse, setParsedApiResponse] = useState<GeminiJsonResponse | null>(null);
  
  const [isProcessingFiles, setIsProcessingFiles] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [totalTimeSaved, setTotalTimeSaved] = useState<number>(0);

  useEffect(() => {
    // Set the worker source for pdf.js. This is crucial for it to work.
    // By importing the worker with `?url`, Vite will handle bundling it
    // and providing the correct path.
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

    try {
      const savedMinutes = localStorage.getItem('totalTimeSavedMinutes');
      if (savedMinutes) {
        const parsedMinutes = parseInt(savedMinutes, 10);
        if (!isNaN(parsedMinutes)) {
            setTotalTimeSaved(parsedMinutes);
        }
      }
    } catch (error) {
        console.error("Failed to read time saved from localStorage", error);
    }
  }, []); // The empty dependency array ensures this effect runs only once.

  const resetAllState = () => {
    setErrorMessage(null);
    setRawApiResponse(null);
    setParsedApiResponse(null);
    setProcessedImageDatas([]);
    setProcessingMessage(null);
    setIsProcessingFiles(false);
    setSelectedFiles([]);
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const processPdfDocument = async (file: File, onPageProcess: (msg: string) => void): Promise<ProcessedImageData[]> => {
    const datas: ProcessedImageData[] = [];
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const numPagesToProcess = Math.min(pdf.numPages, 5);

    for (let i = 1; i <= numPagesToProcess; i++) {
        onPageProcess(`Processando PDF: ${file.name} (página ${i} de ${pdf.numPages})...`);
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const context = canvas.getContext('2d');

        if (!context) {
            throw new Error(`Failed to get canvas context for page ${i}.`);
        }

        await page.render({ canvasContext: context, viewport }).promise;
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        
        datas.push({
            base64: dataUrl.split(',')[1],
            mimeType: 'image/jpeg',
            fileName: file.name,
            pageNumber: i,
        });
    }
    return datas;
  };

  const processDirectImage = async (file: File): Promise<ProcessedImageData> => {
    const dataUrl = await fileToDataUrl(file);
    return {
        base64: dataUrl.split(',')[1],
        mimeType: file.type,
        fileName: file.name
    };
  };

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      resetAllState();
      return;
    }

    resetAllState();
    const filesArray = Array.from(files);
    setSelectedFiles(filesArray);
    setIsProcessingFiles(true);

    const allProcessedData: ProcessedImageData[] = [];

    for (const file of filesArray) {
      const acceptedImageTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'];
      const acceptedPdfType = 'application/pdf';

      try {
        if (file.type === acceptedPdfType) {
          setProcessingMessage(`Iniciando o processamento do PDF: ${file.name}...`);
          const datas = await processPdfDocument(file, (msg) => setProcessingMessage(msg));
          allProcessedData.push(...datas);
        } else if (acceptedImageTypes.includes(file.type)) {
          setProcessingMessage(`Processando imagem: ${file.name}...`);
          const data = await processDirectImage(file);
          allProcessedData.push(data);
        } else {
          console.warn(`Skipping invalid file type: ${file.name}`);
          setErrorMessage(prev => {
            const newError = `Arquivo não suportado ignorado: ${file.name}`;
            return prev ? `${prev}\n${newError}` : newError;
          });
        }
      } catch (error: any) {
        setErrorMessage(prev => {
            const newError = `Falha ao processar ${file.name}: ${error?.message || 'Erro desconhecido'}`;
            return prev ? `${prev}\n${newError}` : newError;
        });
      }
    }

    setProcessedImageDatas(allProcessedData);
    setProcessingMessage(`Processadas ${allProcessedData.length} página(s)/imagem(ns) de ${filesArray.length} arquivo(s). Pronto para análise.`);
    setIsProcessingFiles(false);
  }, []);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(event.target.files);
    if (event.target) {
      event.target.value = ''; // Reset file input to allow re-selection of the same file(s)
    }
  }, [handleFilesSelected]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault(); // Necessary to allow dropping
  }, []);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const files = event.dataTransfer.files;
    if (files && files.length > 0) {
        handleFilesSelected(files);
    }
  }, [handleFilesSelected]);


  const parseGeminiResponse = (rawText: string | null): GeminiJsonResponse | null => {
    if (!rawText) return null;

    let jsonStr = rawText.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    try {
      const parsedData: any = JSON.parse(jsonStr);
      
      if (!Array.isArray(parsedData)) {
        console.error("Parsed data is not an array:", parsedData);
        setErrorMessage("Erro: A resposta da API não foi o array de seções esperado. Exibindo dados brutos.");
        return null;
      }
      
      const normalizedData: ExtractedSection[] = [];

      for (const section of parsedData) {
        if (typeof section.sectionTitle !== 'string' || !Array.isArray(section.fields)) {
          console.warn("Skipping invalid section structure:", section);
          continue; // Skip this section and move to the next
        }

        const normalizedFields: ExtractedField[] = [];
        for (const field of section.fields) {
          if (field && typeof field.topic === 'string') {
            const answer = String(field.answer ?? '');
            normalizedFields.push({ topic: field.topic, answer: answer });
          } else if (field && typeof field === 'object' && !Array.isArray(field) && field !== null) {
            const keys = Object.keys(field);
            if (keys.length > 0) {
              const topic = keys[0];
              const answer = String(field[topic] ?? '');
              normalizedFields.push({ topic: topic, answer: answer });
            } else {
               console.warn("Skipping empty field object:", field);
            }
          } else {
            console.warn("Skipping invalid field structure:", field);
          }
        }
        
        normalizedData.push({
            sectionTitle: section.sectionTitle,
            fields: normalizedFields
        });
      }

      if (normalizedData.length === 0) {
          setErrorMessage("Erro: A resposta da API não pôde ser analisada em nenhuma seção válida. Exibindo dados brutos.");
          return null;
      }

      return normalizedData;
    } catch (e: any) {
      console.error("Failed to parse JSON response:", e);
      setErrorMessage(`Erro ao analisar os resultados: ${e?.message || 'Erro de análise desconhecido'}. Exibindo dados brutos.`);
      return null;
    }
  };

  const handleAnalyzeClick = async () => {
    if (processedImageDatas.length === 0) {
      setErrorMessage('Por favor, selecione e processe um arquivo primeiro.');
      return;
    }

    setIsLoadingApi(true);
    setErrorMessage(null); 
    setRawApiResponse(null);
    setParsedApiResponse(null);

    try {
      const result = await analyzeImagesWithGemini(processedImageDatas, userPrompt);
      setRawApiResponse(result);
      const parsed = parseGeminiResponse(result); 
      if (parsed) {
        setParsedApiResponse(parsed);
        
        const pdfCount = selectedFiles.filter(file => file.type === 'application/pdf').length;
        if (pdfCount > 0) {
            const timeSavedThisSession = pdfCount * 20;
            setTotalTimeSaved(prevTotal => {
                const newTotal = prevTotal + timeSavedThisSession;
                try {
                    localStorage.setItem('totalTimeSavedMinutes', String(newTotal));
                } catch (error) {
                    console.error("Failed to write time saved to localStorage", error);
                }
                return newTotal;
            });
        }
        
        if (errorMessage && (errorMessage.startsWith("Erro ao analisar") || errorMessage.includes("invalid section structure") || errorMessage.includes("invalid field structure") || errorMessage.includes("not the expected array"))) {
            setErrorMessage(null); 
        }
      } else {
         if (!errorMessage && !result) {
            setErrorMessage("Dados recebidos da API estão vazios ou são inválidos. Não é possível exibir como tabela.");
         }
      }
    } catch (error: any) {
      console.error("Error analyzing image(s):", error);
      let displayMessage = 'Falha ao analisar o documento. Verifique o console para mais detalhes.';

      if (error && typeof error.message === 'string') {
        if (error.message.includes("API_KEY is not configured")) {
          displayMessage = "Erro de configuração: A chave da API está ausente. Garanta que ela esteja configurada nas variáveis de ambiente e acessível à aplicação.";
        } else if (error.message.includes("Invalid API Key")) {
          displayMessage = "Erro de autenticação: A chave da API fornecida é inválida. Verifique sua configuração.";
        } else {
          displayMessage = error.message; 
        }
      } else if (error && typeof error.toString === 'function') {
        displayMessage = error.toString();
      }
      
      setErrorMessage(displayMessage);
      setRawApiResponse(null); 
      setParsedApiResponse(null);
    } finally {
      setIsLoadingApi(false);
    }
  };

  const handleExportToExcel = () => {
    if (!parsedApiResponse) return;

    const headers = [
      'Atividade', 'Bacia', 'Projeto', 'Gerador', 'Embarcação de Transporte', 'Base de Apoio',
      'MMR', 'Data MMR', 'Item', 'Tipo de Resíduo', 'Peso (Kg)', 'Acondicionamento',
      'Classe NBR 10.004', 'Código', 'Código do Resíduo', 'RNC', 'Observações Internas',
      'MTR-Transp', 'Data MTR-Transp', 'Peso MTR-Transp (T)', 'Empresa Transportadora (MTR-Transp)',
      'Empresa Receptora (MTR-Transp)', 'MTR-Dest', 'Data MTR-Dest', 'Peso MTR-Dest (T)',
      'Empresa Transportadora (MTR-Dest)', 'Empresa Receptora (MTR-Dest)', 'Ticket de pesagem',
      'Rel. Recebimento - Transp', 'Rel. Recebimento - Dest', 'CDF', 'Forma de Tratamento / Destinação final'
    ];

    let mtrNumber = '', gerador = '', transportador = '', destinador = '', dataTransporte = '';
    const cleanRazaoSocial = (text: string) => text ? text.replace(/[^a-zA-Z\sÀ-ú]/g, '').replace(/\s+/g, ' ').trim() : '';
    
    parsedApiResponse.forEach(section => {
        const titleLower = section.sectionTitle.toLowerCase();
        if (titleLower.includes('cabeçalho')) {
            mtrNumber = section.fields.find(f => f.topic.toLowerCase().includes('mtr n°'))?.answer.replace(/\D/g, '') || '';
        } else if (titleLower.includes('gerador')) {
            gerador = cleanRazaoSocial(section.fields.find(f => f.topic.toLowerCase().includes('razão social'))?.answer || '');
        } else if (titleLower.includes('transportador')) {
            transportador = cleanRazaoSocial(section.fields.find(f => f.topic.toLowerCase().includes('razão social'))?.answer || '');
        } else if (titleLower.includes('destinador')) {
            destinador = cleanRazaoSocial(section.fields.find(f => f.topic.toLowerCase().includes('razão social'))?.answer || '');
        }
        
        if (!dataTransporte) {
            const dateField = section.fields.find(f => 
                f.topic.toLowerCase().includes('data do transporte') ||
                f.topic.toLowerCase().includes('data de emissão')
            );
            if (dateField && dateField.answer) {
              dataTransporte = dateField.answer;
            }
        }
    });

    const wasteItems: any[] = [];
    const residuosSection = parsedApiResponse.find(s => s.sectionTitle.toLowerCase().includes('resíduos'));
    if (residuosSection) {
      let currentItem: any = null;
      residuosSection.fields.forEach(field => {
          if (field.topic.toLowerCase().includes('item nº')) {
              if (currentItem) wasteItems.push(currentItem);
              currentItem = { 'Item': '' };
          }
          if (currentItem) {
              const topic = field.topic.toLowerCase();
              if (topic === 'código ibama') {
                  const codeMatch = field.answer.match(/\d{6}/);
                  if (codeMatch) {
                      const formattedCode = codeMatch[0].replace(/(\d{2})(\d{2})(\d{2})/, '$1 $2 $3');
                      currentItem['Código do Resíduo'] = `${formattedCode} (*)`;
                  } else {
                      currentItem['Código do Resíduo'] = field.answer;
                  }
              } else if (topic === 'qtde') {
                  currentItem.qtde = field.answer;
              } else if (topic === 'unidade') {
                  currentItem.unidade = field.answer;
              }
          }
      });
      if (currentItem) wasteItems.push(currentItem);
    }
    
    let totalQtdeKg = 0;
    wasteItems.forEach(item => {
        if (item.qtde) {
            const value = parseFloat(item.qtde.replace(',', '.'));
            if (!isNaN(value)) {
                const unit = item.unidade ? item.unidade.toLowerCase() : 'kg';
                if (unit === 't' || unit === 'ton' || unit === 'tonelada' || unit === 'toneladas') {
                    totalQtdeKg += value * 1000;
                } else {
                    totalQtdeKg += value;
                }
            }
        }
    });
    const pesoMtrTranspT = totalQtdeKg > 0 ? (totalQtdeKg / 1000).toFixed(5) : '';
    
    const ticketsSection = parsedApiResponse.find(section => section.sectionTitle.toLowerCase().includes('tickets'));
    const ticketFields = ticketsSection 
        ? ticketsSection.fields.filter(f => f.topic.toLowerCase().includes('peso líquido')) 
        : [];

    const exportData: any[] = [];
    const baseData = {
        'Gerador': gerador,
        'MTR-Transp': mtrNumber,
        'Data MTR-Transp': dataTransporte,
        'Peso MTR-Transp (T)': pesoMtrTranspT,
        'Empresa Transportadora (MTR-Transp)': transportador,
        'Empresa Receptora (MTR-Transp)': destinador,
        'Empresa Receptora (MTR-Dest)': destinador,
    };

    if (ticketFields.length > 0) {
        const consolidatedWasteInfo = {
            'Tipo de Resíduo': '',
            'Acondicionamento': '',
            'Classe NBR 10.004': '',
            'Código do Resíduo': wasteItems.map(i => i['Código do Resíduo']).filter(Boolean).join(' / '),
            'Forma de Tratamento / Destinação final': '',
            'Item': '',
        };

        ticketFields.forEach(ticketField => {
            const cleanNumberStr = ticketField.answer.replace(/\./g, '').replace(',', '.');
            const numericMatch = cleanNumberStr.match(/(\d+(\.\d+)?)/);
            let ticketWeightKg = '';
            if (numericMatch) {
                const value = parseFloat(numericMatch[0]);
                if (!isNaN(value)) {
                    ticketWeightKg = value.toFixed(2);
                }
            }
            
            const row = { 
                ...baseData,
                ...consolidatedWasteInfo,
                'Ticket de pesagem': ticketWeightKg ? 'ok' : '',
                'Peso (Kg)': ticketWeightKg,
            };
            exportData.push(row);
        });

    } else if (wasteItems.length > 0) {
        wasteItems.forEach((item) => {
            const { qtde, unidade, ...itemForExport } = item;
            const row = { 
                ...baseData, 
                ...itemForExport,
                'Ticket de pesagem': '',
                'Peso (Kg)': '',
            };
            exportData.push(row);
        });
    } else {
        const row = { 
          ...baseData,
          'Ticket de pesagem': '',
          'Peso (Kg)': '',
        };
        exportData.push(row);
    }
    
    const worksheet = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.sheet_add_json(worksheet, exportData, { 
      origin: 'A2', 
      skipHeader: true, 
      header: headers 
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Controle de MTRs');

    const fileName = `MTR_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(workbook, fileName);
  };

  const LoadingSpinner: React.FC<{text?: string}> = ({ text = "Analisando..."}) => (
    <div className="flex items-center justify-center space-x-2">
      <svg className="animate-spin h-5 w-5 text-orange-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      <span className="text-white">{text}</span>
    </div>
  );
  
  const supportedFormatsText = "(JPG, PNG, PDF, WEBP, GIF, BMP)";
  
  const escapeHtml = (unsafe: string): string =>
    unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");

  const formatRawResponseForDisplay = (rawText: string | null): string => {
    if (!rawText) {
      return '<p class="text-white">Nenhum dado bruto para exibir.</p>';
    }

    let jsonStr = rawText.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const parsingFailed = errorMessage && (
        errorMessage.startsWith("Erro ao analisar") || 
        errorMessage.includes("invalid section structure") || 
        errorMessage.includes("invalid field structure") ||
        errorMessage.includes("not the expected array")
    );

    const message = parsingFailed ? 
        `<p class="text-white mb-2 text-sm">Exibindo abaixo a saída JSON bruta e limpa recebida da IA, pois a resposta não pôde ser totalmente estruturada em uma tabela. Por favor, consulte a mensagem de erro acima para detalhes.</p>`:
        `<p class="text-white mb-2 text-sm">A resposta da IA não pôde ser estruturada em uma tabela. Exibindo abaixo a saída JSON bruta e limpa recebida da IA.</p>`;


    return `${message}
            <div class="text-white p-3 bg-slate-600 rounded-md shadow mt-1">
                <pre class="whitespace-pre-wrap text-xs sm:text-sm">${escapeHtml(jsonStr)}</pre>
            </div>`;
  };

  const renderTableFromApiResponse = (data: GeminiJsonResponse | null): React.ReactNode => {
    if (!data) {
        return <p className="text-white">Nenhum dado estruturado disponível para exibir em formato de tabela.</p>;
    }

    return (
        <div className="overflow-x-auto space-y-8">
            {data.map((section, sectionIndex) => (
                <div key={sectionIndex}>
                    <h3 className="text-xl font-semibold mt-2 mb-3 text-white border-b-2 border-slate-600 pb-2">
                        {escapeHtml(section.sectionTitle)}
                    </h3>
                    {section.fields && section.fields.length > 0 ? (
                        <table className="min-w-full divide-y divide-slate-600 border border-slate-600 rounded-md shadow-lg">
                            <thead className="bg-slate-700/80">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/3 sm:w-1/4">
                                        Tópico
                                    </th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                                        Resposta
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-slate-700/50 divide-y divide-slate-600/70">
                                {section.fields.flatMap((field, fieldIdx) => {
                                    const isObservacoesGeradorSection = section.sectionTitle.toLowerCase().includes("observações do gerador");
                                    const isObservacoesField = field.topic.toLowerCase().startsWith("observaç");

                                    if (isObservacoesGeradorSection && isObservacoesField && field.answer.includes('\n')) {
                                        const lines = field.answer.split('\n')
                                                                  .map(line => line.trim())
                                                                  .filter(line => line !== '');
                                        
                                        if (lines.length > 1) {
                                            return lines.map((line, lineIndex) => (
                                                <tr key={`${section.sectionTitle}-${field.topic}-${fieldIdx}-${lineIndex}`} 
                                                    className={(fieldIdx + lineIndex) % 2 === 0 ? 'bg-slate-600/40' : 'bg-slate-600/60 hover:bg-slate-500/60'}>
                                                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white align-top">
                                                        {escapeHtml(field.topic)} {`(Linha ${lineIndex + 1})`}
                                                    </td>
                                                    <td className="px-4 py-3 whitespace-pre-wrap text-sm text-white align-top">
                                                        {escapeHtml(line)}
                                                    </td>
                                                </tr>
                                            ));
                                        }
                                    }
                                    
                                    return [( 
                                        <tr key={`${section.sectionTitle}-${field.topic}-${fieldIdx}-single`} 
                                            className={fieldIdx % 2 === 0 ? 'bg-slate-600/40' : 'bg-slate-600/60 hover:bg-slate-500/60'}>
                                            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white align-top">
                                                {escapeHtml(field.topic)}
                                            </td>
                                            <td className="px-4 py-3 whitespace-pre-wrap text-sm text-white align-top">
                                                {escapeHtml(field.answer)}
                                            </td>
                                        </tr>
                                    )];
                                })}
                            </tbody>
                        </table>
                    ) : (
                        <p className="text-white italic ml-4">Nenhum campo encontrado para esta seção.</p>
                    )}
                </div>
            ))}
        </div>
    );
  };
  
  const previewsByFile = processedImageDatas.reduce((acc, data) => {
      if (!acc[data.fileName]) {
          acc[data.fileName] = [];
      }
      acc[data.fileName].push(data);
      return acc;
  }, {} as Record<string, ProcessedImageData[]>);

  return (
    <div 
      className="min-h-screen text-white p-4 sm:p-6 md:p-8 flex flex-col items-center"
    >
      <header className="w-full max-w-4xl mb-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-white text-shadow">
          AutoMTR & Tickets
        </h1>
        <p className="mt-2 text-lg text-white text-shadow">
          Extraia informações de formulários MTR e Tickets de pesagem com facilidade usando IA.
        </p>
      </header>

      <main className="w-full max-w-2xl bg-slate-900/70 backdrop-blur-md shadow-2xl rounded-lg p-6 sm:p-8 space-y-6">
        <section>
            <h2 className="text-2xl font-semibold mb-3 text-white text-center">1. Envie os Documentos MTR</h2>
            <div
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className="relative"
            >
                <div
                    onClick={() => document.getElementById('fileUpload')?.click()}
                    className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ${
                        isDragging ? 'border-orange-500 bg-slate-700/80' : 'border-slate-600 hover:border-orange-400 hover:bg-slate-700/50'
                    }`}
                    role="button"
                    tabIndex={0}
                    aria-label="Área de upload de arquivos"
                >
                    <input
                        id="fileUpload"
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif,image/bmp,application/pdf"
                        onChange={handleFileChange}
                        className="hidden"
                        multiple
                    />
                    <div className="text-center pointer-events-none">
                        <svg className="mx-auto h-12 w-12 text-slate-400" stroke="currentColor" fill="none" viewBox="0 0 48 48" aria-hidden="true">
                            <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        
                        {selectedFiles.length > 0 && !isProcessingFiles && !isDragging ? (
                             <>
                                <p className="mt-2 text-sm font-semibold text-white">{`${selectedFiles.length} arquivo(s) pronto(s) para análise.`}</p>
                                <p className="text-xs text-slate-400">Solte novos arquivos ou clique para substituir.</p>
                            </>
                        ) : (
                            <>
                                <p className="mt-2 text-sm text-slate-300">
                                    <span className="font-semibold text-orange-400">Clique para enviar</span> ou arraste e solte
                                </p>
                                <p className="text-xs text-slate-400">{supportedFormatsText}</p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {(isProcessingFiles || (processingMessage && processedImageDatas.length === 0 && selectedFiles.length > 0)) && (
                <div className="mt-3 text-sm flex items-center justify-center text-white">
                    {isProcessingFiles ?
                        <LoadingSpinner text={processingMessage || "Processando arquivos..."} /> :
                        <p className="text-white">{processingMessage}</p>
                    }
                </div>
            )}
        </section>

        {processedImageDatas.length > 0 && !isProcessingFiles && (
          <section id="image-deployment-space" className="mt-6 border-2 border-dashed border-slate-600 rounded-lg p-4 bg-slate-700/60">
            <h2 className="text-xl font-semibold mb-3 text-white">Pré-visualização dos Documentos</h2>
            <div className="space-y-6">
              {Object.entries(previewsByFile).map(([fileName, fileData]) => (
                <div key={fileName} className="p-3 bg-slate-700/80 rounded-lg">
                  <h3 className="text-lg font-medium text-white border-b border-slate-600 pb-2 mb-3">
                    {escapeHtml(fileName)}
                    {fileData.length > 1 && ` (${fileData.length} páginas)`}
                  </h3>
                  <div className="space-y-4">
                    {fileData.map((data, index) => (
                      <div key={`${data.fileName}-${data.pageNumber || index}`} className="flex flex-col items-center">
                        {data.pageNumber && <p className="text-sm text-white mb-1">Página {data.pageNumber}</p>} 
                        <img 
                          src={`data:${data.mimeType};base64,${data.base64}`}
                          alt={`Pré-visualização de ${escapeHtml(fileName)} ${data.pageNumber ? `página ${data.pageNumber}` : `imagem ${index + 1}`}`}
                          className="max-w-full max-h-96 rounded-md object-contain shadow-lg"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
        
        <section className="text-center mt-6">
          <button
            onClick={handleAnalyzeClick}
            disabled={isLoadingApi || isProcessingFiles || processedImageDatas.length === 0}
            className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed text-lg"
            aria-label="Analisar Documentos"
          >
            {isLoadingApi ? <LoadingSpinner text="Analisando Documentos..." /> : 'Analisar Documentos'}
          </button>
        </section>

        {errorMessage && !isLoadingApi && !isProcessingFiles && (
            <section className="mt-6 p-4 bg-red-800/50 border border-red-600 text-white rounded-md" role="alert"> 
                <p className="font-semibold text-white">Erro:</p> 
                <p className="whitespace-pre-wrap">{errorMessage}</p>
            </section>
        )}

        { (isLoadingApi || rawApiResponse) && !isProcessingFiles && (
          <section className="mt-6 p-4 bg-slate-700/60 rounded-lg">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold text-white">Informações Extraídas</h2> 
              {parsedApiResponse && (
                <button
                  onClick={handleExportToExcel}
                  className="bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 px-4 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out text-sm"
                  aria-label="Exportar para Excel"
                >
                  Exportar para Excel
                </button>
              )}
            </div>
            
            {isLoadingApi && <LoadingSpinner text="Buscando resultados..." />}

            {!isLoadingApi && rawApiResponse && ( 
              parsedApiResponse ? ( 
                renderTableFromApiResponse(parsedApiResponse)
              ) : ( 
                <div 
                  dangerouslySetInnerHTML={{ __html: formatRawResponseForDisplay(rawApiResponse) }}
                />
              )
            )}
            {!isLoadingApi && !rawApiResponse && !errorMessage && selectedFiles.length > 0 && (
                 <p className="text-white">Nenhum dado foi retornado ou extraído dos documentos. A API pode não ter encontrado informações relevantes.</p> 
            )}
          </section>
        )}
      </main>
      
      <footer className="w-full max-w-4xl mt-12 text-center text-white">
        <p className="text-shadow">2025 AutoMTR. Desenvolvido por Consultoria ESG - EVP</p>
        {totalTimeSaved > 0 && (
            <p className="text-sm text-slate-300 mt-2 text-shadow" aria-live="polite">
                Você já economizou {totalTimeSaved} minutos da sua vida. Parabéns!
            </p>
        )}
      </footer>
    </div>
  );
};

export default App;