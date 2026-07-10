import React from 'react';
import type { ExtractedSection, GeminiJsonResponse } from '../types';

const SectionTable: React.FC<{ section: ExtractedSection }> = ({ section }) => {
  const isObservacoesGerador = section.sectionTitle
    .toLowerCase()
    .includes('observações do gerador');

  return (
    <div>
      <h3 className="text-xl font-semibold mt-2 mb-3 text-white border-b-2 border-slate-600 pb-2">
        {section.sectionTitle}
      </h3>
      {section.fields.length > 0 ? (
        <table className="min-w-full divide-y divide-slate-600 border border-slate-600 rounded-md shadow-lg">
          <thead className="bg-slate-700/80">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider w-1/3 sm:w-1/4">
                Tópico
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-white uppercase tracking-wider">
                Resposta
              </th>
            </tr>
          </thead>
          <tbody className="bg-slate-700/50 divide-y divide-slate-600/70">
            {section.fields.flatMap((field, fieldIdx) => {
              const isObservacoesField = field.topic.toLowerCase().startsWith('observaç');

              // Observações do gerador com várias linhas são quebradas em várias linhas da tabela.
              if (isObservacoesGerador && isObservacoesField && field.answer.includes('\n')) {
                const lines = field.answer
                  .split('\n')
                  .map((line) => line.trim())
                  .filter((line) => line !== '');

                if (lines.length > 1) {
                  return lines.map((line, lineIndex) => (
                    <tr
                      key={`${field.topic}-${fieldIdx}-${lineIndex}`}
                      className={
                        (fieldIdx + lineIndex) % 2 === 0
                          ? 'bg-slate-600/40'
                          : 'bg-slate-600/60 hover:bg-slate-500/60'
                      }
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white align-top">
                        {field.topic} {`(Linha ${lineIndex + 1})`}
                      </td>
                      <td className="px-4 py-3 whitespace-pre-wrap text-sm text-white align-top">
                        {line}
                      </td>
                    </tr>
                  ));
                }
              }

              return [
                <tr
                  key={`${field.topic}-${fieldIdx}`}
                  className={
                    fieldIdx % 2 === 0 ? 'bg-slate-600/40' : 'bg-slate-600/60 hover:bg-slate-500/60'
                  }
                >
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white align-top">
                    {field.topic}
                  </td>
                  <td className="px-4 py-3 whitespace-pre-wrap text-sm text-white align-top">
                    {field.answer}
                  </td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      ) : (
        <p className="text-white italic ml-4">Nenhum campo encontrado para esta seção.</p>
      )}
    </div>
  );
};

export const ResultsTable: React.FC<{ data: GeminiJsonResponse }> = ({ data }) => (
  <div className="overflow-x-auto space-y-8">
    {data.map((section, index) => (
      <SectionTable key={`${section.sectionTitle}-${index}`} section={section} />
    ))}
  </div>
);
