import ExcelJS from 'exceljs';
import type { GeminiJsonResponse } from '../types';

// Layout da planilha de rastreabilidade do MMR, validado contra a planilha
// real usada pelo cliente (aba "Rastreabilidade"). 16 colunas, nesta ordem
// exata. Peso (Kg), Quantidade, Unidade e MTR não pertencem a este layout —
// vêm de outros documentos (Ticket de pesagem e MTR), não do MMR.
export const HEADERS = [
  'Atividade',
  'Bacia',
  'Projeto',
  'POÇO',
  'Gerador',
  'Embarcação de Transporte',
  'Base de Apoio',
  'MMR/MRB/FCDR',
  'Data MMR',
  'Item',
  'Tipo de Resíduo',
  'Descrição do MMR',
  'Acondicionamento',
  'Classe NBR 10.004',
  'Código do resíduo',
  'RNC',
] as const;

export type MmrExportRow = Record<string, string>;

interface MmrWasteItem {
  item: string;
  codigo: string;
  tipoResiduo: string;
  descricao: string;
  acondicionamento: string;
  classeNbr: string;
}

const newWasteItem = (): MmrWasteItem => ({
  item: '',
  codigo: '',
  tipoResiduo: '',
  descricao: '',
  acondicionamento: '',
  classeNbr: '',
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
    } else if (topic === 'classe nbr') {
      current.classeNbr = field.answer;
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
    'POÇO': headerField('Poço'),
    Gerador: headerField('Gerador'),
    'Embarcação de Transporte': headerField('Transportador'),
    'Base de Apoio': headerField('Base de Apoio'),
    'MMR/MRB/FCDR': headerField('MMR N°'),
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
    'Código do resíduo': item.codigo,
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
