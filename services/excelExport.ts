import ExcelJS from 'exceljs';
import type { GeminiJsonResponse } from '../types';

// Layout da planilha "Controle de MTRs": ordem e nomes das colunas são mantidos
// exatamente como na versão original.
export const HEADERS = [
  'Atividade',
  'Bacia',
  'Projeto',
  'Gerador',
  'Embarcação de Transporte',
  'Base de Apoio',
  'MMR',
  'Data MMR',
  'Item',
  'Tipo de Resíduo',
  'Peso (Kg)',
  'Acondicionamento',
  'Classe NBR 10.004',
  'Código',
  'Código do Resíduo',
  'RNC',
  'Observações Internas',
  'MTR-Transp',
  'Data MTR-Transp',
  'Peso MTR-Transp (T)',
  'Empresa Transportadora (MTR-Transp)',
  'Empresa Receptora (MTR-Transp)',
  'MTR-Dest',
  'Data MTR-Dest',
  'Peso MTR-Dest (T)',
  'Empresa Transportadora (MTR-Dest)',
  'Empresa Receptora (MTR-Dest)',
  'Ticket de pesagem',
  'Rel. Recebimento - Transp',
  'Rel. Recebimento - Dest',
  'CDF',
  'Forma de Tratamento / Destinação final',
] as const;

export type ExportRow = Record<string, string>;

interface WasteItem {
  itemNumber: string;
  codigoResiduo: string;
  denominacao: string;
  classe: string;
  acondicionamento: string;
  tecnologia: string;
  qtde: string;
  unidade: string;
}

const newWasteItem = (): WasteItem => ({
  itemNumber: '',
  codigoResiduo: '',
  denominacao: '',
  classe: '',
  acondicionamento: '',
  tecnologia: '',
  qtde: '',
  unidade: '',
});

const cleanRazaoSocial = (text: string): string =>
  text
    ? text
        .replace(/[^a-zA-Z\sÀ-ú]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
    : '';

const join = (values: string[]): string => values.filter(Boolean).join(' / ');

const formatCodigoResiduo = (answer: string): string => {
  const codeMatch = answer.match(/\d{6}/);
  if (codeMatch) {
    const formatted = codeMatch[0].replace(/(\d{2})(\d{2})(\d{2})/, '$1 $2 $3');
    return `${formatted} (*)`;
  }
  return answer;
};

const parseWasteItems = (residuosFields: { topic: string; answer: string }[]): WasteItem[] => {
  const items: WasteItem[] = [];
  let current = newWasteItem();
  let hasData = false;

  for (const field of residuosFields) {
    const topic = field.topic.toLowerCase();

    if (topic.includes('item nº')) {
      // Fecha o item anterior (se já acumulou dados) e começa um novo.
      if (hasData) items.push(current);
      current = newWasteItem();
      current.itemNumber = field.answer;
      hasData = true;
      continue;
    }

    // Campos que aparecem antes do primeiro "Item Nº" também são capturados
    // (a versão antiga os descartava porque o item corrente era nulo).
    if (topic === 'código ibama') {
      current.codigoResiduo = formatCodigoResiduo(field.answer);
    } else if (topic === 'denominação') {
      current.denominacao = field.answer;
    } else if (topic === 'classe') {
      current.classe = field.answer;
    } else if (topic === 'acondicionamento') {
      current.acondicionamento = field.answer;
    } else if (topic === 'tecnologia de tratamento') {
      current.tecnologia = field.answer;
    } else if (topic === 'qtde') {
      current.qtde = field.answer;
    } else if (topic === 'unidade') {
      current.unidade = field.answer;
    } else {
      continue;
    }
    hasData = true;
  }

  if (hasData) items.push(current);
  return items;
};

const totalQtdeToTons = (items: WasteItem[]): string => {
  let totalKg = 0;
  for (const item of items) {
    if (!item.qtde) continue;
    const value = parseFloat(item.qtde.replace(',', '.'));
    if (isNaN(value)) continue;
    const unit = item.unidade ? item.unidade.toLowerCase() : 'kg';
    if (unit === 't' || unit === 'ton' || unit === 'tonelada' || unit === 'toneladas') {
      totalKg += value * 1000;
    } else {
      totalKg += value;
    }
  }
  return totalKg > 0 ? (totalKg / 1000).toFixed(5) : '';
};

const ticketWeightKg = (answer: string): string => {
  const cleanNumberStr = answer.replace(/\./g, '').replace(',', '.');
  const numericMatch = cleanNumberStr.match(/(\d+(\.\d+)?)/);
  if (numericMatch) {
    const value = parseFloat(numericMatch[0]);
    if (!isNaN(value)) return value.toFixed(2);
  }
  return '';
};

/**
 * Transforma a resposta estruturada da IA nas linhas da planilha "Controle de MTRs".
 * Função pura (sem DOM/estado), facilmente testável.
 */
export const buildExportRows = (data: GeminiJsonResponse): ExportRow[] => {
  let mtrNumber = '';
  let gerador = '';
  let transportador = '';
  let destinador = '';
  let dataTransporte = '';

  data.forEach((section) => {
    const titleLower = section.sectionTitle.toLowerCase();
    if (titleLower.includes('cabeçalho')) {
      mtrNumber =
        section.fields
          .find((f) => f.topic.toLowerCase().includes('mtr n°'))
          ?.answer.replace(/\D/g, '') || '';
    } else if (titleLower.includes('gerador')) {
      gerador = cleanRazaoSocial(
        section.fields.find((f) => f.topic.toLowerCase().includes('razão social'))?.answer || '',
      );
    } else if (titleLower.includes('transportador')) {
      transportador = cleanRazaoSocial(
        section.fields.find((f) => f.topic.toLowerCase().includes('razão social'))?.answer || '',
      );
    } else if (titleLower.includes('destinador')) {
      destinador = cleanRazaoSocial(
        section.fields.find((f) => f.topic.toLowerCase().includes('razão social'))?.answer || '',
      );
    }

    if (!dataTransporte) {
      const dateField = section.fields.find(
        (f) =>
          f.topic.toLowerCase().includes('data do transporte') ||
          f.topic.toLowerCase().includes('data de emissão'),
      );
      if (dateField && dateField.answer) {
        dataTransporte = dateField.answer;
      }
    }
  });

  const residuosSection = data.find((s) => s.sectionTitle.toLowerCase().includes('resíduos'));
  const wasteItems = residuosSection ? parseWasteItems(residuosSection.fields) : [];
  const pesoMtrTranspT = totalQtdeToTons(wasteItems);

  const ticketsSection = data.find((s) => s.sectionTitle.toLowerCase().includes('tickets'));
  const ticketFields = ticketsSection
    ? ticketsSection.fields.filter((f) => f.topic.toLowerCase().includes('peso líquido'))
    : [];

  const baseData: ExportRow = {
    Gerador: gerador,
    'MTR-Transp': mtrNumber,
    'Data MTR-Transp': dataTransporte,
    'Peso MTR-Transp (T)': pesoMtrTranspT,
    'Empresa Transportadora (MTR-Transp)': transportador,
    'Empresa Receptora (MTR-Transp)': destinador,
    'Empresa Receptora (MTR-Dest)': destinador,
  };

  const rows: ExportRow[] = [];

  if (ticketFields.length > 0) {
    // Uma linha por ticket. Os dados dos resíduos são consolidados (concatenados).
    const consolidated: ExportRow = {
      Item: join(wasteItems.map((i) => i.itemNumber)),
      'Tipo de Resíduo': join(wasteItems.map((i) => i.denominacao)),
      Acondicionamento: join(wasteItems.map((i) => i.acondicionamento)),
      'Classe NBR 10.004': join(wasteItems.map((i) => i.classe)),
      'Código do Resíduo': join(wasteItems.map((i) => i.codigoResiduo)),
      'Forma de Tratamento / Destinação final': join(wasteItems.map((i) => i.tecnologia)),
    };

    ticketFields.forEach((ticketField) => {
      const weight = ticketWeightKg(ticketField.answer);
      rows.push({
        ...baseData,
        ...consolidated,
        'Ticket de pesagem': weight ? 'ok' : '',
        'Peso (Kg)': weight,
      });
    });
  } else if (wasteItems.length > 0) {
    // Uma linha por item de resíduo.
    wasteItems.forEach((item) => {
      rows.push({
        ...baseData,
        Item: item.itemNumber,
        'Tipo de Resíduo': item.denominacao,
        Acondicionamento: item.acondicionamento,
        'Classe NBR 10.004': item.classe,
        'Código do Resíduo': item.codigoResiduo,
        'Forma de Tratamento / Destinação final': item.tecnologia,
        'Ticket de pesagem': '',
        'Peso (Kg)': '',
      });
    });
  } else {
    // Sem itens nem tickets: uma linha base.
    rows.push({
      ...baseData,
      'Ticket de pesagem': '',
      'Peso (Kg)': '',
    });
  }

  return rows;
};

/**
 * Monta o workbook ExcelJS com a aba "Controle de MTRs" a partir dos dados parseados.
 * Função pura: não toca em DOM nem em estado.
 */
export const buildWorkbook = (data: GeminiJsonResponse): ExcelJS.Workbook => {
  const rows = buildExportRows(data);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Controle de MTRs');

  worksheet.addRow([...HEADERS]);
  rows.forEach((row) => {
    worksheet.addRow(HEADERS.map((header) => row[header] ?? ''));
  });

  return workbook;
};
