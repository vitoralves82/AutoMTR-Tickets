import { describe, it, expect } from 'vitest';
import { buildMmrExportRows, buildMmrWorkbook, HEADERS } from './mmrExcelExport';
import type { GeminiJsonResponse } from '../types';

const cabecalho = {
  sectionTitle: 'Cabeçalho do MMR',
  fields: [
    { topic: 'MMR N°', answer: '026/2025' },
    { topic: 'Data', answer: '27-fev-25' },
    { topic: 'Gerador', answer: 'VALARIS DS-17' },
    { topic: 'Transportador', answer: 'DELTA COMMANDER' },
    { topic: 'Base de Apoio', answer: 'TRIUNFO LOGÍSTICA' },
    { topic: 'Atividade', answer: 'Perfuração' },
    { topic: 'Bacia', answer: 'Bacalhau' },
    { topic: 'Poço', answer: 'WI-5' },
    { topic: 'Projeto', answer: '' },
  ],
};

describe('buildMmrExportRows — vários itens de resíduo', () => {
  const data: GeminiJsonResponse = [
    cabecalho,
    {
      sectionTitle: 'Itens de Resíduo',
      fields: [
        { topic: 'Item Nº', answer: '1' },
        { topic: 'Código', answer: 'A009' },
        { topic: 'Tipo de Resíduo', answer: 'Madeira não contaminada' },
        { topic: 'Descrição', answer: 'Non contaminated wood' },
        { topic: 'Acondicionamento', answer: 'Lote' },
        { topic: 'Quantidade', answer: '1' },
        { topic: 'Unidade', answer: 'UN' },
        { topic: 'Peso (Kg)', answer: '715' },
        { topic: 'Classe NBR', answer: 'IIA' },
        { topic: 'MTR', answer: '2113232195' },
        { topic: 'Item Nº', answer: '2' },
        { topic: 'Código', answer: 'B001' },
        { topic: 'Tipo de Resíduo', answer: 'Sucata metálica' },
        { topic: 'Descrição', answer: 'Scrap metal' },
        { topic: 'Acondicionamento', answer: 'Big Bag' },
        { topic: 'Quantidade', answer: '2' },
        { topic: 'Unidade', answer: 'UN' },
        { topic: 'Peso (Kg)', answer: '340' },
        { topic: 'Classe NBR', answer: 'IIB' },
        { topic: 'MTR', answer: '2113232196' },
      ],
    },
  ];

  const rows = buildMmrExportRows(data);

  it('gera uma linha por item de resíduo', () => {
    expect(rows).toHaveLength(2);
  });

  it('mapeia corretamente os campos de cada item, sem Peso (Kg)/Quantidade/Unidade/MTR', () => {
    expect(rows[0]['Item']).toBe('1');
    expect(rows[0]['Código do resíduo']).toBe('A009');
    expect(rows[0]['Tipo de Resíduo']).toBe('Madeira não contaminada');
    expect(rows[0]['Descrição do MMR']).toBe('Non contaminated wood');
    expect(rows[0]['Acondicionamento']).toBe('Lote');
    expect(rows[0]['Classe NBR 10.004']).toBe('IIA');
    expect(rows[0]['Peso (Kg)']).toBeUndefined();
    expect(rows[0]['Quantidade']).toBeUndefined();
    expect(rows[0]['Unidade']).toBeUndefined();
    expect(rows[0]['MTR']).toBeUndefined();

    expect(rows[1]['Item']).toBe('2');
    expect(rows[1]['Código do resíduo']).toBe('B001');
    expect(rows[1]['Peso (Kg)']).toBeUndefined();
  });

  it('repete os dados de cabeçalho em todas as linhas', () => {
    for (const row of rows) {
      expect(row['MMR/MRB/FCDR']).toBe('026/2025');
      expect(row['Data MMR']).toBe('27-fev-25');
      expect(row['Gerador']).toBe('VALARIS DS-17');
      expect(row['Embarcação de Transporte']).toBe('DELTA COMMANDER');
      expect(row['Base de Apoio']).toBe('TRIUNFO LOGÍSTICA');
      expect(row['Atividade']).toBe('Perfuração');
      expect(row['Bacia']).toBe('Bacalhau');
      expect(row['POÇO']).toBe('WI-5');
    }
  });

  it('deixa a coluna RNC sempre vazia', () => {
    for (const row of rows) {
      expect(row['RNC']).toBe('');
    }
  });
});

describe('buildMmrExportRows — sem itens de resíduo', () => {
  it('gera uma única linha só com o cabeçalho preenchido', () => {
    const rows = buildMmrExportRows([cabecalho]);
    expect(rows).toHaveLength(1);
    expect(rows[0]['MMR/MRB/FCDR']).toBe('026/2025');
    expect(rows[0]['Gerador']).toBe('VALARIS DS-17');
    expect(rows[0]['RNC']).toBe('');
    expect(rows[0]['Item']).toBeUndefined();
  });

  it('gera uma linha vazia quando não há nenhuma seção', () => {
    const rows = buildMmrExportRows([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]['MMR/MRB/FCDR']).toBe('');
    expect(rows[0]['RNC']).toBe('');
  });
});

describe('buildMmrWorkbook', () => {
  it('cria a aba "Rastreabilidade" com o cabeçalho correto', () => {
    const workbook = buildMmrWorkbook([cabecalho]);
    const worksheet = workbook.getWorksheet('Rastreabilidade');
    expect(worksheet).toBeDefined();
    const headerRow = worksheet!.getRow(1).values as string[];
    expect(headerRow[1]).toBe(HEADERS[0]);
    expect(headerRow.slice(1)).toHaveLength(HEADERS.length);
  });

  it('não inclui a coluna RNC preenchida', () => {
    const workbook = buildMmrWorkbook([cabecalho]);
    const worksheet = workbook.getWorksheet('Rastreabilidade')!;
    const rncIndex = HEADERS.indexOf('RNC') + 1;
    const dataRow = worksheet.getRow(2).values as string[];
    expect(dataRow[rncIndex]).toBeFalsy();
  });
});
