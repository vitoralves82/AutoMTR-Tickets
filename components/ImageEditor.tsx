
import React, { useState, useCallback } from 'react';
import { ImageEditorProps } from '../types';

const applyRotation = (dataUrl: string, degrees: number): Promise<{ rotatedDataUrl: string; newMimeType: string }> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.src = dataUrl;
    image.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return reject(new Error('Could not get canvas context.'));
      }

      const normalizedDegrees = (degrees % 360 + 360) % 360;
      const rads = normalizedDegrees * Math.PI / 180;
      const w = image.width;
      const h = image.height;

      if (normalizedDegrees === 90 || normalizedDegrees === 270) {
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
      const rotatedDataUrl = canvas.toDataURL(newMimeType, 0.9); // Use JPEG with quality setting
      
      resolve({ rotatedDataUrl, newMimeType });
    };
    image.onerror = (err) => reject(new Error(`Failed to load image for rotation: ${String(err)}`));
  });
};

const ImageEditor: React.FC<ImageEditorProps> = ({ imageSrc, onSave, onClose }) => {
  const [rotation, setRotation] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleRotate = (angle: number) => {
    setRotation(prev => prev + angle);
  };

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const finalRotation = (rotation % 360 + 360) % 360;
      if (finalRotation === 0) {
        const parts = imageSrc.split(',');
        const mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        onSave(parts[1], mimeType);
      } else {
        const { rotatedDataUrl, newMimeType } = await applyRotation(imageSrc, finalRotation);
        const newBase64 = rotatedDataUrl.split(',')[1];
        onSave(newBase64, newMimeType);
      }
      onClose();
    } catch (error) {
      console.error("Error saving rotated image:", error);
      alert("Houve um erro ao salvar a imagem. Tente novamente.");
    } finally {
      setIsSaving(false);
    }
  }, [rotation, imageSrc, onSave, onClose]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog">
      <div className="bg-slate-800 rounded-lg shadow-2xl p-4 sm:p-6 w-full max-w-4xl flex flex-col max-h-[90vh]">
        <h2 className="text-xl sm:text-2xl font-semibold text-slate-50 mb-4">Editar Imagem</h2>
        
        <div className="flex-grow flex items-center justify-center bg-slate-900 rounded overflow-hidden mb-4 min-h-[40vh]">
          <img 
            src={imageSrc} 
            alt="Image preview for editing" 
            className="max-w-full max-h-[55vh] object-contain transition-transform duration-300 ease-in-out"
            style={{ transform: `rotate(${rotation}deg)` }}
          />
        </div>

        <div className="flex flex-wrap justify-center items-center gap-4 mb-6">
            <button onClick={() => handleRotate(-90)} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 15L3 9m0 0l6-6M3 9h12a6 6 0 010 12h-3" /></svg>
                Girar 90° Esquerda
            </button>
            <button onClick={() => handleRotate(90)} className="bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded-lg inline-flex items-center transition-colors">
                 <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l6-6m0 0l-6-6m6 6H9a6 6 0 000 12h3" /></svg>
                Girar 90° Direita
            </button>
        </div>

        <div className="flex justify-end gap-4 mt-auto">
          <button onClick={onClose} disabled={isSaving} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 font-bold py-2 px-6 rounded-lg transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={isSaving} className="bg-teal-600 hover:bg-teal-700 disabled:bg-slate-600 text-white font-bold py-2 px-6 rounded-lg transition-colors flex items-center">
            {isSaving && (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {isSaving ? 'Salvando...' : 'Salvar e Fechar'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ImageEditor;
