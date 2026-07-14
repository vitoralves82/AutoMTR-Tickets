import React from 'react';
import type { DocumentType } from '../types';

interface DocumentTypeOption {
  value: DocumentType;
  label: string;
}

const OPTIONS: DocumentTypeOption[] = [
  { value: 'mtr', label: 'MTR — Manifesto de Transporte de Resíduos' },
  { value: 'mmr', label: 'MMR — Manifesto Marítimo de Resíduos' },
];

interface DocumentTypeSelectorProps {
  value: DocumentType;
  onChange: (type: DocumentType) => void;
  disabled?: boolean;
}

export const DocumentTypeSelector: React.FC<DocumentTypeSelectorProps> = ({
  value,
  onChange,
  disabled = false,
}) => (
  <section>
    <h2 className="text-2xl font-semibold mb-3 text-white text-center">1. Tipo de Documento</h2>
    <div
      className="flex flex-col sm:flex-row gap-3"
      role="radiogroup"
      aria-label="Tipo de documento"
    >
      {OPTIONS.map((option) => (
        <label
          key={option.value}
          className={`flex-1 flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors duration-200 ${
            value === option.value
              ? 'border-orange-500 bg-slate-700/80'
              : 'border-slate-600 hover:border-orange-400 hover:bg-slate-700/50'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <input
            type="radio"
            name="documentType"
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            disabled={disabled}
            className="accent-orange-500"
          />
          <span className="text-sm text-white">{option.label}</span>
        </label>
      ))}
    </div>
  </section>
);
