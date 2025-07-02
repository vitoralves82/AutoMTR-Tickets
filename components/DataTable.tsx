
import React from 'react';
import { DataTableProps, MMRHeader, MMRWasteItem } from '../types';

const DataField: React.FC<{ label: string; value: string | number | null | undefined }> = ({ label, value }) => (
  <div className="py-2 px-3">
    <p className="text-sm font-semibold text-slate-100">{label}</p>
    <p className="text-md text-slate-100 break-words">{value !== null && value !== undefined ? String(value) : 'N/A'}</p>
  </div>
);

const DataTable: React.FC<DataTableProps> = ({ data }) => {
  const { header, items } = data;

  const renderHeaderSection = (sectionTitle: string, headerData: MMRHeader | null) => (
    <div className="mb-8 p-6 bg-slate-700 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold text-slate-50 mb-4 border-b border-slate-600 pb-2">{sectionTitle}</h3>
      {headerData ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
          <DataField label="MMR N°" value={headerData.mmrNo} />
          <DataField label="Data" value={headerData.data} />
          <DataField label="Gerador" value={headerData.gerador} />
          <DataField label="Transportador" value={headerData.transportador} />
          <DataField label="Base de Apoio" value={headerData.baseDeApoio} />
          <DataField label="Atividade" value={headerData.atividade} />
          <DataField label="Bacia" value={headerData.bacia} />
          <DataField label="Poço" value={headerData.poco} />
          <DataField label="Projeto" value={headerData.projeto} />
        </div>
      ) : (
        <p className="text-slate-400">Dados do cabeçalho não disponíveis.</p>
      )}
    </div>
  );
  
  const renderItemsTable = (wasteItems: MMRWasteItem[]) => (
    <div className="p-6 bg-slate-700 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold text-slate-50 mb-4 border-b border-slate-600 pb-2">Itens de Resíduo</h3>
      {wasteItems && wasteItems.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-600">
            <thead className="bg-slate-750">
              <tr>
                {['Item', 'Código', 'Tipo de Resíduo', 'Descrição', 'Acondicionamento', 'Qtd.', 'Un.', 'Peso (KG)', 'Classe NBR', 'MTR'].map(col => (
                  <th key={col} scope="col" className="px-4 py-3 text-left text-xs font-semibold text-slate-200 uppercase tracking-wider">
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-slate-700 divide-y divide-slate-600">
              {wasteItems.map((item, index) => (
                <tr key={index} className="hover:bg-slate-600 transition-colors duration-150">
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200">{item.item ?? 'N/A'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200">{item.codigo ?? 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-slate-200 min-w-[150px] break-words">{item.tipoDeResiduo ?? 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-slate-200 min-w-[200px] break-words">{item.descricao ?? 'N/A'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200">{item.acondicionamento ?? 'N/A'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200 text-right">{item.quantidade ?? 'N/A'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200">{item.unidade ?? 'N/A'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200 text-right">{item.pesoKg ?? 'N/A'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200">{item.classeNbr ?? 'N/A'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200">{item.mtr ?? 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-slate-400">Nenhum item de resíduo encontrado ou extraído.</p>
      )}
    </div>
  );

  return (
    <div className="mt-6 space-y-8">
      {renderHeaderSection("Dados Gerais do MMR", header)}
      {renderItemsTable(items)}
    </div>
  );
};

export default DataTable;