
import React, { useState, useCallback, useRef } from 'react';
import { ImageUploadProps } from '../types';
import * as pdfjsLib from 'pdfjs-lib';

// Set worker source for pdfjs-dist to match the version from importmap.
// This ensures the worker version always corresponds to the library version.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs';

const ImageUpload: React.FC<ImageUploadProps> = ({ onImageSelect, apiProcessing, previewUrl }) => {
  const [isConvertingPdf, setIsConvertingPdf] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const combinedIsLoading = apiProcessing || isConvertingPdf;

  const processSelectedFile = useCallback(async (file: File) => {
    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      alert('Por favor, selecione um arquivo de imagem (JPG, PNG, WEBP) ou PDF.');
      if (fileInputRef.current) {
        fileInputRef.current.value = ""; // Reset file input
      }
      return;
    }

    if (file.type === 'application/pdf') {
      setIsConvertingPdf(true);
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const arrayBuffer = event.target?.result as ArrayBuffer;
          if (!arrayBuffer) {
            throw new Error('Não foi possível ler o arquivo PDF.');
          }
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1); // Process only the first page

          const scale = 1.5; // Adjust scale for quality
          const viewport = page.getViewport({ scale });

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;

          if (!context) {
            throw new Error('Não foi possível obter o contexto do canvas.');
          }

          await page.render({ canvasContext: context, viewport: viewport }).promise;
          
          const dataUrl = canvas.toDataURL('image/jpeg'); // Convert to JPEG
          const base64String = dataUrl.split(',')[1];
          onImageSelect(file, base64String, 'image/jpeg', dataUrl);
        } catch (pdfError) {
          console.error('Erro ao processar PDF:', pdfError);
          alert(`Erro ao converter PDF para imagem: ${pdfError instanceof Error ? pdfError.message : String(pdfError)}`);
          if (fileInputRef.current) fileInputRef.current.value = "";
        } finally {
          setIsConvertingPdf(false);
        }
      };
      reader.onerror = () => {
        alert('Erro ao ler o arquivo PDF.');
        if (fileInputRef.current) fileInputRef.current.value = "";
        setIsConvertingPdf(false);
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Handle regular image files
      const reader = new FileReader();
      reader.onloadend = () => {
        const dataUrl = reader.result as string;
        const base64String = dataUrl.split(',')[1];
        onImageSelect(file, base64String, file.type, dataUrl);
      };
      reader.readAsDataURL(file);
    }
  }, [onImageSelect]);

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  }, [processSelectedFile]);

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (combinedIsLoading) return;

    const file = event.dataTransfer.files?.[0];
    if (file) {
      if (fileInputRef.current) {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        fileInputRef.current.files = dataTransfer.files;
      }
      processSelectedFile(file);
    }
  }, [processSelectedFile, combinedIsLoading]);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const openFileDialog = () => {
    if (combinedIsLoading) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="w-full max-w-xl mx-auto p-4">
      <div 
        className={`border-2 border-dashed border-slate-500 rounded-lg p-8 text-center transition-colors duration-150 ${combinedIsLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-teal-500'}`}
        onClick={openFileDialog}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        role="button"
        tabIndex={combinedIsLoading ? -1 : 0}
        aria-label="Upload de imagem ou PDF"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openFileDialog();}}
      >
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          onChange={handleFileChange}
          className="hidden"
          ref={fileInputRef}
          disabled={combinedIsLoading}
        />
        {isConvertingPdf ? (
          <div className="flex flex-col items-center p-4" aria-live="polite">
            <svg className="animate-spin h-10 w-10 text-teal-500 mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <p className="text-slate-300">Convertendo PDF para imagem...</p>
          </div>
        ) : previewUrl ? (
          <img src={previewUrl} alt="Pré-visualização do arquivo selecionado" className="max-h-64 mx-auto rounded-md shadow-lg" />
        ) : (
          <div className="flex flex-col items-center">
            <svg className="w-16 h-16 text-slate-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
            <p className="text-slate-300">
              Arraste e solte um arquivo aqui, ou <span className="text-sky-400 font-semibold">clique para selecionar</span>.
            </p>
            <p className="text-xs text-slate-500 mt-1">Formatos suportados: JPG, PNG, WEBP, PDF</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageUpload;