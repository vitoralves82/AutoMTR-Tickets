import React from 'react';

// Exibição de fallback quando a resposta da IA não pôde ser estruturada em tabela.
// Renderiza o JSON bruto com JSX normal (sem dangerouslySetInnerHTML).
export const RawResponse: React.FC<{ rawText: string | null }> = ({ rawText }) => {
  if (!rawText) {
    return <p className="text-white">Nenhum dado bruto para exibir.</p>;
  }

  let display = rawText.trim();
  try {
    display = JSON.stringify(JSON.parse(display), null, 2);
  } catch {
    // Mantém o texto original se não for JSON válido.
  }

  return (
    <div>
      <p className="text-white mb-2 text-sm">
        A resposta da IA não pôde ser estruturada em uma tabela. Exibindo abaixo a saída JSON bruta
        recebida.
      </p>
      <div className="text-white p-3 bg-slate-600 rounded-md shadow mt-1">
        <pre className="whitespace-pre-wrap text-xs sm:text-sm">{display}</pre>
      </div>
    </div>
  );
};
