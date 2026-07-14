import ExcelJS from 'exceljs';
import type { GeminiJsonResponse } from '../types';

// Layout da planilha de rastreabilidade do MMR. A ordem exata ainda será
// validada contra a planilha real do cliente.
export const HEADERS = [
  'Atividade',
  'Bacia',
  'Projeto',
  'Poço',
  'Gerador',
  'Embarcação de Transporte',
  'Base de Apoio',
  'MMR',
  'Data MMR',
  'Item',
  'Tipo de Resíduo',
  'Descrição do MMR',
  'Acondicionamento',
  'Classe NBR 10.004',
  'Código do Resíduo',
  'Peso (Kg)',
  'Quantidade',
  'Unidade',
  'MTR',
  'RNC',
] as const;

export type MmrExportRow = Record<string, string>;

interface MmrWasteItem {
  item: string;
  codigo: string;
  tipoResiduo: string;
  descricao: string;
  acondicionamento: string;
  quantidade: string;
  unidade: string;
  pesoKg: string;
  classeNbr: string;
  mtr: string;
}

const newWasteItem = (): MmrWasteItem => ({
  item: '',
  codigo: '',
  tipoResiduo: '',
  descricao: '',
  acondicionamento: '',
  quantidade: '',
  unidade: '',
  pesoKg: '',
  classeNbr: '',
  mtr: '',
});

const parseWasteItems = (itensFields: { topic: string; answer: string }[]): MmrWasteItem[] => {
  const items: MmrWasteItem[] = [];
  let current = newWasteItem();
  let hasData = false;

  for (const field of itensFields) {
    const topic = field.topic.toLowerCase();

    if (topic.includes('item nº')) {
      if (hasData) items.push(current);
      current = newWasteItem();
      current.item = field.answer;
      hasData = true;
      continue;
    }

    if (topic === 'código') {
      current.codigo = field.answer;
    } else if (topic === 'tipo de resíduo') {
      current.tipoResiduo = field.answer;
    } else if (topic === 'descrição') {
      current.descricao = field.answer;
    } else if (topic === 'acondicionamento') {
      current.acondicionamento = field.answer;
    } else if (topic === 'quantidade') {
      current.quantidade = field.answer;
    } else if (topic === 'unidade') {
      current.unidade = field.answer;
    } else if (topic === 'peso (kg)') {
      current.pesoKg = field.answer;
    } else if (topic === 'classe nbr') {
      current.classeNbr = field.answer;
    } else if (topic === 'mtr') {
      current.mtr = field.answer;
    } else {
      continue;
    }
    hasData = true;
  }

  if (hasData) items.push(current);
  return items;
};

/**
 * Transforma a resposta estruturada da IA nas linhas da planilha de
 * rastreabilidade do MMR. Função pura (sem DOM/estado), facilmente testável.
 */
export const buildMmrExportRows = (data: GeminiJsonResponse): MmrExportRow[] => {
  const headerSection = data.find((s) => s.sectionTitle.toLowerCase().includes('cabeçalho'));
  const headerField = (topic: string): string =>
    headerSection?.fields.find((f) => f.topic.toLowerCase() === topic.toLowerCase())?.answer || '';

  const baseData: MmrExportRow = {
    Atividade: headerField('Atividade'),
    Bacia: headerField('Bacia'),
    Projeto: headerField('Projeto'),
    Poço: headerField('Poço'),
    Gerador: headerField('Gerador'),
    'Embarcação de Transporte': headerField('Transportador'),
    'Base de Apoio': headerField('Base de Apoio'),
    MMR: headerField('MMR N°'),
    'Data MMR': headerField('Data'),
    RNC: '',
  };

  const itensSection = data.find((s) => s.sectionTitle.toLowerCase().includes('itens de resíduo'));
  const wasteItems = itensSection ? parseWasteItems(itensSection.fields) : [];

  if (wasteItems.length === 0) {
    // Sem itens: uma única linha com os dados de cabeçalho já preenchidos.
    return [{ ...baseData }];
  }

  return wasteItems.map((item) => ({
    ...baseData,
    Item: item.item,
    'Tipo de Resíduo': item.tipoResiduo,
    'Descrição do MMR': item.descricao,
    Acondicionamento: item.acondicionamento,
    'Classe NBR 10.004': item.classeNbr,
    'Código do Resíduo': item.codigo,
    'Peso (Kg)': item.pesoKg,
    Quantidade: item.quantidade,
    Unidade: item.unidade,
    MTR: item.mtr,
  }));
};

/**
 * Monta o workbook ExcelJS com a aba "Rastreabilidade" a partir dos dados
 * parseados do MMR. Função pura: não toca em DOM nem em estado.
 */
export const buildMmrWorkbook = (data: GeminiJsonResponse): ExcelJS.Workbook => {
  const rows = buildMmrExportRows(data);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Rastreabilidade');

  worksheet.addRow([...HEADERS]);
  rows.forEach((row) => {
    worksheet.addRow(HEADERS.map((header) => row[header] ?? ''));
  });

  return workbook;
};
