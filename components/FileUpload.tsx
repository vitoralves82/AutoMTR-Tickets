import React, { useCallback, useRef, useState } from 'react';
import { LoadingSpinner } from './LoadingSpinner';

const SUPPORTED_FORMATS_TEXT = '(PDF, JPG, PNG, WEBP)';
const ACCEPT = 'application/pdf,image/jpeg,image/png,image/webp';

interface FileUploadProps {
  onFilesSelected: (files: FileList | null) => void;
  selectedCount: number;
  isProcessing: boolean;
  processingMessage: string | null;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  selectedCount,
  isProcessing,
  processingMessage,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onFilesSelected(event.target.files);
      event.target.value = ''; // Permite reselecionar os mesmos arquivos.
    },
    [onFilesSelected],
  );

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragging(false);
      if (event.dataTransfer.files?.length) onFilesSelected(event.dataTransfer.files);
    },
    [onFilesSelected],
  );

  return (
    <section>
      <h2 className="text-2xl font-semibold mb-3 text-white text-center">2. Envie os Documentos</h2>
      <div
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragOver={(e) => e.preventDefault()}
        onDragLeave={(e) => {
          e.preventDefault();
          setIsDragging(false);
        }}
        onDrop={handleDrop}
        className="relative"
      >
        <div
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center p-8 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ${
            isDragging
              ? 'border-orange-500 bg-slate-700/80'
              : 'border-slate-600 hover:border-orange-400 hover:bg-slate-700/50'
          }`}
          role="button"
          tabIndex={0}
          aria-label="Área de upload de arquivos"
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={handleChange}
            className="hidden"
            multiple
          />
          <div className="text-center pointer-events-none">
            <svg
              className="mx-auto h-12 w-12 text-slate-400"
              stroke="currentColor"
              fill="none"
              viewBox="0 0 48 48"
              aria-hidden="true"
            >
              <path
                d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>

            {selectedCount > 0 && !isProcessing && !isDragging ? (
              <>
                <p className="mt-2 text-sm font-semibold text-white">
                  {`${selectedCount} arquivo(s) pronto(s) para análise.`}
                </p>
                <p className="text-xs text-slate-400">
                  Solte novos arquivos ou clique para substituir.
                </p>
              </>
            ) : (
              <>
                <p className="mt-2 text-sm text-slate-300">
                  <span className="font-semibold text-orange-400">Clique para enviar</span> ou
                  arraste e solte
                </p>
                <p className="text-xs text-slate-400">{SUPPORTED_FORMATS_TEXT}</p>
              </>
            )}
          </div>
        </div>
      </div>

      {isProcessing && (
        <div className="mt-3 text-sm flex items-center justify-center text-white">
          <LoadingSpinner text={processingMessage || 'Processando arquivos...'} />
        </div>
      )}
    </section>
  );
};
