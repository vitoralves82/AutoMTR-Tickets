import { describe, it, expect } from 'vitest';
import { parseGeminiResponse } from './responseParser';

describe('parseGeminiResponse', () => {
  it('parseia uma resposta válida', () => {
    const raw = JSON.stringify([
      { sectionTitle: 'Cabeçalho do Documento', fields: [{ topic: 'MTR n°', answer: '123' }] },
    ]);
    const result = parseGeminiResponse(raw);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toHaveLength(1);
      expect(result.data[0].sectionTitle).toBe('Cabeçalho do Documento');
      expect(result.data[0].fields[0].answer).toBe('123');
    }
  });

  it('rejeita uma seção malformada (sem fields)', () => {
    const raw = JSON.stringify([{ sectionTitle: 'A' }]);
    const result = parseGeminiResponse(raw);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/formato esperado/i);
  });

  it('rejeita JSON inválido', () => {
    const result = parseGeminiResponse('{ isto não é json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/analisar/i);
  });

  it('rejeita resposta vazia', () => {
    expect(parseGeminiResponse(null).ok).toBe(false);
    expect(parseGeminiResponse('').ok).toBe(false);
  });
});
