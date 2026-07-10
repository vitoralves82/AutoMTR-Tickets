import React from 'react';
import { FileUpload } from './components/FileUpload';
import { DocumentPreview } from './components/DocumentPreview';
import { ResultsTable } from './components/ResultsTable';
import { RawResponse } from './components/RawResponse';
import { ErrorAlert } from './components/ErrorAlert';
import { LoadingSpinner } from './components/LoadingSpinner';
import { useDocumentAnalysis } from './hooks/useDocumentAnalysis';

const App: React.FC = () => {
  const {
    selectedFiles,
    processedFiles,
    rawApiResponse,
    parsedApiResponse,
    isProcessingFiles,
    processingMessage,
    isLoadingApi,
    errorMessage,
    totalTimeSaved,
    handleFilesSelected,
    analyze,
  } = useDocumentAnalysis();

  const handleExportToExcel = async () => {
    if (!parsedApiResponse) return;

    // exceljs é grande; carregado sob demanda para não pesar o bundle inicial.
    const { buildWorkbook } = await import('./services/excelExport');
    const workbook = buildWorkbook(parsedApiResponse);
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });

    const fileName = `MTR_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen text-white p-4 sm:p-6 md:p-8 flex flex-col items-center">
      <header className="w-full max-w-4xl mb-8 text-center">
        <h1 className="text-4xl sm:text-5xl font-bold text-white text-shadow">
          AutoMTR &amp; Tickets
        </h1>
        <p className="mt-2 text-lg text-white text-shadow">
          Extraia informações de formulários MTR e Tickets de pesagem com facilidade usando IA.
        </p>
      </header>

      <main className="w-full max-w-2xl bg-slate-900/70 backdrop-blur-md shadow-2xl rounded-lg p-6 sm:p-8 space-y-6">
        <FileUpload
          onFilesSelected={handleFilesSelected}
          selectedCount={selectedFiles.length}
          isProcessing={isProcessingFiles}
          processingMessage={processingMessage}
        />

        {!isProcessingFiles && <DocumentPreview files={processedFiles} />}

        <section className="text-center mt-6">
          <button
            onClick={analyze}
            disabled={isLoadingApi || isProcessingFiles || processedFiles.length === 0}
            className="w-full sm:w-auto bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 text-white font-semibold py-3 px-8 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105 disabled:transform-none disabled:cursor-not-allowed text-lg"
            aria-label="Analisar Documentos"
          >
            {isLoadingApi ? (
              <LoadingSpinner text="Analisando Documentos..." />
            ) : (
              'Analisar Documentos'
            )}
          </button>
        </section>

        {errorMessage && !isLoadingApi && !isProcessingFiles && (
          <ErrorAlert message={errorMessage} />
        )}

        {(isLoadingApi || rawApiResponse) && !isProcessingFiles && (
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

            {!isLoadingApi &&
              rawApiResponse &&
              (parsedApiResponse ? (
                <ResultsTable data={parsedApiResponse} />
              ) : (
                <RawResponse rawText={rawApiResponse} />
              ))}
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
