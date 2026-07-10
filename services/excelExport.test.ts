import { describe, it, expect } from 'vitest';
import { buildExportRows, buildWorkbook, HEADERS } from './excelExport';
import type { GeminiJsonResponse } from '../types';

describe('buildExportRows — cenário só com itens de resíduo', () => {
  const data: GeminiJsonResponse = [
    {
      sectionTitle: 'Cabeçalho do Documento',
      fields: [{ topic: 'MTR n°', answer: '2113238175' }],
    },
    {
      sectionTitle: 'Identificação do Gerador',
      fields: [{ topic: 'Razão Social', answer: '134218 - EQUINOR BRASIL ENERGIA LTDA' }],
    },
    {
      sectionTitle: 'Identificação dos Resíduos',
      fields: [
        { topic: 'Item Nº', answer: '1' },
        { topic: 'Código IBAMA', answer: '180103' },
        { topic: 'Denominação', answer: 'Resíduos de serviços de saúde' },
        { topic: 'Classe', answer: 'I' },
        { topic: 'Acondicionamento', answer: 'Saco Plástico' },
        { topic: 'Qtde', answer: '2' },
        { topic: 'Unidade', answer: 't' },
        { topic: 'Tecnologia de Tratamento', answer: 'Incineração' },
      ],
    },
  ];

  const rows = buildExportRows(data);

  it('gera uma linha por item', () => {
    expect(rows).toHaveLength(1);
  });

  it('preenche as colunas que antes ficavam vazias', () => {
    expect(rows[0]['Item']).toBe('1');
    expect(rows[0]['Tipo de Resíduo']).toBe('Resíduos de serviços de saúde');
    expect(rows[0]['Classe NBR 10.004']).toBe('I');
    expect(rows[0]['Acondicionamento']).toBe('Saco Plástico');
    expect(rows[0]['Forma de Tratamento / Destinação final']).toBe('Incineração');
  });

  it('formata o código IBAMA como "XX XX XX (*)"', () => {
    expect(rows[0]['Código do Resíduo']).toBe('18 01 03 (*)');
  });

  it('converte toneladas para o peso total em toneladas', () => {
    // 2 t -> 2000 kg -> 2.00000 T
    expect(rows[0]['Peso MTR-Transp (T)']).toBe('2.00000');
  });

  it('limpa a razão social (remove números e símbolos)', () => {
    expect(rows[0]['Gerador']).toBe('EQUINOR BRASIL ENERGIA LTDA');
    expect(rows[0]['MTR-Transp']).toBe('2113238175');
  });
});

describe('buildExportRows — cenário com tickets', () => {
  const data: GeminiJsonResponse = [
    {
      sectionTitle: 'Identificação dos Resíduos',
      fields: [
        { topic: 'Item Nº', answer: '1' },
        { topic: 'Código IBAMA', answer: '180103' },
        { topic: 'Denominação', answer: 'RSS' },
        { topic: 'Classe', answer: 'I' },
        { topic: 'Tecnologia de Tratamento', answer: 'Incineração' },
      ],
    },
    {
      sectionTitle: 'TICKETS',
      fields: [
        { topic: 'Peso Líquido (Ticket 1)', answer: '5.400,00' },
        { topic: 'Peso Líquido (Ticket 2)', answer: '3.250,00' },
      ],
    },
  ];

  const rows = buildExportRows(data);

  it('gera uma linha por ticket', () => {
    expect(rows).toHaveLength(2);
  });

  it('extrai o peso líquido de cada ticket', () => {
    expect(rows[0]['Peso (Kg)']).toBe('5400.00');
    expect(rows[0]['Ticket de pesagem']).toBe('ok');
    expect(rows[1]['Peso (Kg)']).toBe('3250.00');
  });

  it('consolida os dados dos resíduos nas linhas de ticket', () => {
    expect(rows[0]['Tipo de Resíduo']).toBe('RSS');
    expect(rows[0]['Classe NBR 10.004']).toBe('I');
    expect(rows[0]['Código do Resíduo']).toBe('18 01 03 (*)');
    expect(rows[0]['Forma de Tratamento / Destinação final']).toBe('Incineração');
  });
});

describe('buildExportRows — correção do bug de item', () => {
  it('captura campos que aparecem antes do primeiro "Item Nº"', () => {
    const data: GeminiJsonResponse = [
      {
        sectionTitle: 'Identificação dos Resíduos',
        fields: [
          { topic: 'Código IBAMA', answer: '180103' },
          { topic: 'Denominação', answer: 'RSS' },
        ],
      },
    ];
    const rows = buildExportRows(data);
    expect(rows).toHaveLength(1);
    expect(rows[0]['Código do Resíduo']).toBe('18 01 03 (*)');
    expect(rows[0]['Tipo de Resíduo']).toBe('RSS');
  });
});

describe('buildWorkbook', () => {
  it('cria a aba "Controle de MTRs" com o cabeçalho correto', () => {
    const workbook = buildWorkbook([]);
    const worksheet = workbook.getWorksheet('Controle de MTRs');
    expect(worksheet).toBeDefined();
    const headerRow = worksheet!.getRow(1).values as string[];
    // headerRow[0] é vazio (ExcelJS indexa colunas a partir de 1).
    expect(headerRow[1]).toBe(HEADERS[0]);
    expect(headerRow.slice(1)).toHaveLength(HEADERS.length);
  });
});
