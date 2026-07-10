import React, { useState, useCallback, useEffect } from 'react';
import { analyzeImagesWithGemini } from './services/geminiService';
import * as XLSX from 'xlsx';
import {
  ALLOWED_MIME_TYPES,
  MAX_FILES,
  MAX_PAYLOAD_BYTES,
  geminiResponseSchema,
  type ProcessedImageData,
  type ExtractedField,
  type ExtractedSection,
  type GeminiJsonResponse,
} from './types';

const App: React.FC = () => {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [processedImageDatas, setProcessedImageDatas] = useState<ProcessedImageData[]>([]);

  const [rawApiResponse, setRawApiResponse] = useState<string | null>(null);
  const [parsedApiResponse, setParsedApiResponse] = useState<GeminiJsonResponse | null>(null);
  
  const [isProcessingFiles, setIsProcessingFiles] = useState<boolean>(false);
  const [processingMessage, setProcessingMessage] = useState<string | null>(null);
  const [isLoadingApi, setIsLoadingApi] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [totalTimeSaved, setTotalTimeSaved] = useState<number>(0);

  useEffect(() => {
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

  // O Gemini processa PDFs nativamente: cada arquivo é lido para base64 e enviado
  // como está (application/pdf ou imagem), sem rasterização no navegador.
  const processFile = async (file: File): Promise<ProcessedImageData> => {
    const dataUrl = await fileToDataUrl(file);
    return {
      base64: dataUrl.split(',')[1],
      mimeType: file.type as ProcessedImageData['mimeType'],
      fileName: file.name,
    };
  };

  const isAcceptedType = (type: string): boolean =>
    (ALLOWED_MIME_TYPES as readonly string[]).includes(type);

  const handleFilesSelected = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) {
      resetAllState();
      return;
    }

    resetAllState();
    const filesArray = Array.from(files);

    if (filesArray.length > MAX_FILES) {
      setErrorMessage(`Máximo de ${MAX_FILES} arquivos por análise. Selecione menos arquivos.`);
      return;
    }

    setSelectedFiles(filesArray);
    setIsProcessingFiles(true);

    const allProcessedData: ProcessedImageData[] = [];

    for (const file of filesArray) {
      try {
        if (isAcceptedType(file.type)) {
          setProcessingMessage(`Processando: ${file.name}...`);
          const data = await processFile(file);
          allProcessedData.push(data);
        } else {
          setErrorMessage((prev) => {
            const newError = `Arquivo não suportado ignorado: ${file.name} (aceitos: PDF, JPG, PNG, WEBP)`;
            return prev ? `${prev}\n${newError}` : newError;
          });
        }
      } catch (error: any) {
        setErrorMessage((prev) => {
          const newError = `Falha ao processar ${file.name}: ${error?.message || 'Erro desconhecido'}`;
          return prev ? `${prev}\n${newError}` : newError;
        });
      }
    }

    setProcessedImageDatas(allProcessedData);
    if (allProcessedData.length > 0) {
      setProcessingMessage(
        `Processado(s) ${allProcessedData.length} de ${filesArray.length} arquivo(s). Pronto para análise.`,
      );
    }
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


  // Com structured output (responseSchema) no servidor, a resposta já chega como
  // JSON no formato esperado. Basta parsear e validar com o schema compartilhado.
  const parseGeminiResponse = (rawText: string | null): GeminiJsonResponse | null => {
    if (!rawText) return null;

    try {
      const result = geminiResponseSchema.safeParse(JSON.parse(rawText));
      if (!result.success) {
        console.error('Resposta da IA não corresponde ao formato esperado:', result.error);
        setErrorMessage(
          'Erro: A resposta da IA não está no formato esperado. Exibindo dados brutos.',
        );
        return null;
      }
      return result.data;
    } catch (e: any) {
      console.error('Falha ao analisar a resposta JSON:', e);
      setErrorMessage(
        `Erro ao analisar os resultados: ${e?.message || 'erro desconhecido'}. Exibindo dados brutos.`,
      );
      return null;
    }
  };

  const handleAnalyzeClick = async () => {
    if (processedImageDatas.length === 0) {
      setErrorMessage('Por favor, selecione e processe um arquivo primeiro.');
      return;
    }

    // Verificação de tamanho antes de enviar (o servidor também rejeita, mas assim
    // o usuário recebe um erro claro sem depender do round-trip).
    const payloadBytes = processedImageDatas.reduce(
      (sum, d) => sum + Math.floor((d.base64.length * 3) / 4),
      0,
    );
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
      const result = await analyzeImagesWithGemini(processedImageDatas);
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
  
  const supportedFormatsText = "(PDF, JPG, PNG, WEBP)";
  
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
  
  const formatFileSize = (base64: string): string => {
    const bytes = Math.floor((base64.length * 3) / 4);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
                        accept="application/pdf,image/jpeg,image/png,image/webp"
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
                  </h3>
                  <div className="space-y-4">
                    {fileData.map((data, index) => (
                      <div key={`${data.fileName}-${index}`} className="flex flex-col items-center">
                        {data.mimeType === 'application/pdf' ? (
                          <div className="flex items-center gap-3 w-full p-3 bg-slate-600/60 rounded-md">
                            <svg className="h-10 w-10 text-orange-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <div className="text-sm text-white">
                              <p className="font-medium">Documento PDF</p>
                              <p className="text-slate-300">{formatFileSize(data.base64)}</p>
                            </div>
                          </div>
                        ) : (
                          <img
                            src={`data:${data.mimeType};base64,${data.base64}`}
                            alt={`Pré-visualização de ${fileName}`}
                            className="max-w-full max-h-96 rounded-md object-contain shadow-lg"
                          />
                        )}
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
