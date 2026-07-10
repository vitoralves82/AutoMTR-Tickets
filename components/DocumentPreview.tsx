import React from 'react';
import { formatFileSize } from '../utils/files';
import type { ProcessedImageData } from '../types';

export const DocumentPreview: React.FC<{ files: ProcessedImageData[] }> = ({ files }) => {
  if (files.length === 0) return null;

  return (
    <section className="mt-6 border-2 border-dashed border-slate-600 rounded-lg p-4 bg-slate-700/60">
      <h2 className="text-xl font-semibold mb-3 text-white">Pré-visualização dos Documentos</h2>
      <div className="space-y-4">
        {files.map((file, index) => (
          <div key={`${file.fileName}-${index}`} className="p-3 bg-slate-700/80 rounded-lg">
            <h3 className="text-lg font-medium text-white border-b border-slate-600 pb-2 mb-3">
              {file.fileName}
            </h3>
            {file.mimeType === 'application/pdf' ? (
              <div className="flex items-center gap-3 w-full p-3 bg-slate-600/60 rounded-md">
                <svg
                  className="h-10 w-10 text-orange-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div className="text-sm text-white">
                  <p className="font-medium">Documento PDF</p>
                  <p className="text-slate-300">{formatFileSize(file.base64)}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <img
                  src={`data:${file.mimeType};base64,${file.base64}`}
                  alt={`Pré-visualização de ${file.fileName}`}
                  className="max-w-full max-h-96 rounded-md object-contain shadow-lg"
                />
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};
