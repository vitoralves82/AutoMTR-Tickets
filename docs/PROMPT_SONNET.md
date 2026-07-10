# Prompt para execução com Claude Sonnet

Copie o bloco abaixo e execute em uma sessão do Claude Code (Sonnet) na raiz deste
repositório. O prompt foi desenhado para ser executado em fases, com commits separados,
para facilitar revisão e rollback.

---

Modernize este repositório (AutoMTR & Tickets — extração de dados de MTRs e tickets de pesagem via Gemini, com exportação para Excel). A análise completa dos problemas está em `docs/ANALISE_REPOSITORIO.md` — leia antes de começar. Trabalhe em fases, na ordem abaixo, fazendo um commit ao final de cada fase com mensagem descritiva. Não altere o comportamento de negócio da exportação Excel além do que está explicitamente pedido. A UI deve permanecer em português.

## Fase 1 — Segurança (não pule)

1. Em `api/analyze.ts`: mova o prompt de extração (hoje em `App.tsx`, constante `userPrompt`) para o servidor. O endpoint deve deixar de aceitar `promptText` do cliente — receba apenas os arquivos. Atualize `services/geminiService.ts` e `types.ts` de acordo.
2. Valide o corpo da requisição com `zod`: lista não vazia de arquivos, mimeTypes permitidos apenas (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`), máximo de 10 arquivos, e rejeite payloads acima de 4 MB com erro 413 e mensagem clara em português.
3. Em `vite.config.ts`: remova o bloco `define` que injeta `GEMINI_API_KEY` no bundle do cliente (é resquício perigoso — nenhum código do frontend usa).
4. Remova `.env.local` do controle de versão (`git rm --cached .env.local`) — o `.gitignore` já cobre `*.local`.
5. Adicione `export const config = { maxDuration: 60 }` (ou o equivalente atual da Vercel) na função serverless.

## Fase 2 — Pipeline de extração moderno

1. Envie PDFs diretamente ao Gemini como `inlineData` com `mimeType: 'application/pdf'` — o Gemini processa PDFs nativamente. Remova completamente a rasterização client-side: exclua a dependência `pdfjs-dist`, a função `processPdfDocument` e o limite de 5 páginas. Para a pré-visualização na UI, mostre apenas nome do arquivo, tipo e tamanho (para imagens pode manter a miniatura).
2. No upload, aceite somente os formatos que o Gemini suporta: PDF, JPEG, PNG e WEBP. Remova GIF e BMP do `accept` e da validação.
3. Use structured output: defina um `responseSchema` (via `@google/genai`) que espelhe os tipos `ExtractedSection`/`ExtractedField` de `types.ts` e passe-o em `config.responseSchema` junto com `responseMimeType: 'application/json'`. Com isso, simplifique radicalmente `parseGeminiResponse` em `App.tsx`: elimine a remoção de cercas de markdown e a normalização de formatos alternativos — apenas `JSON.parse` + validação com o mesmo schema zod compartilhado.
4. Antes de escolher o modelo, consulte a documentação/lista de modelos disponíveis do Gemini e use o modelo flash mais recente estável (a família Gemini 3 foi lançada no fim de 2025; `gemini-2.5-flash` é o mínimo aceitável como fallback). Deixe o nome do modelo em uma constante configurável por variável de ambiente (`GEMINI_MODEL`, com default no código).
5. Se o payload total exceder ~4 MB mesmo assim, mostre erro claro ao usuário sugerindo enviar menos arquivos — não falhe silenciosamente.

## Fase 3 — Correções na exportação Excel

1. Troque a dependência `xlsx@0.18.5` (tem CVEs conhecidas e está abandonada no npm) por `exceljs`, mantendo exatamente o mesmo layout: aba "Controle de MTRs", os mesmos 32 cabeçalhos na mesma ordem, mesma lógica de linhas (uma por ticket quando há tickets; senão uma por item de resíduo; senão uma linha base).
2. Corrija o mapeamento que hoje perde dados extraídos: preencha `Tipo de Resíduo` a partir de `Denominação`, `Classe NBR 10.004` a partir de `Classe`, `Acondicionamento` a partir de `Acondicionamento` e `Forma de Tratamento / Destinação final` a partir de `Tecnologia de Tratamento` — tanto nas linhas por item quanto (concatenado com ` / `) nas linhas por ticket. Preencha também a coluna `Item` com o número do item.
3. Corrija o bug em que campos de resíduo que aparecem antes do primeiro `Item Nº` são descartados (inicialize o item corrente no primeiro campo da seção, não apenas ao encontrar `Item Nº`).
4. Extraia toda a lógica de exportação de `App.tsx` para um módulo puro `services/excelExport.ts` que recebe os dados parseados e retorna o workbook — sem tocar em DOM/estado.

## Fase 4 — Qualidade de base

1. Divida `App.tsx` (830 linhas) em componentes (`FileUpload`, `DocumentPreview`, `ResultsTable`, `ErrorAlert`) e um hook `useDocumentAnalysis` com o estado do fluxo. Corrija o bug de estado stale: remova os `setErrorMessage` de dentro de `parseGeminiResponse` (a função deve retornar resultado ou lançar/retornar erro; quem chama decide o estado) e elimine a checagem morta de `errorMessage` na closure de `handleAnalyzeClick`.
2. Remova as chamadas a `escapeHtml()` dentro de JSX (React já escapa; hoje há duplo escape visível — `&` vira `&amp;`). Elimine também o `dangerouslySetInnerHTML` da exibição de resposta bruta, renderizando com JSX normal.
3. Instale Tailwind CSS como dependência do projeto (removendo o CDN de `index.html`) na versão atual, com configuração mínima. Troque a imagem de fundo hotlinked de site de terceiro por um gradiente CSS local equivalente (tons escuros de slate).
4. Ajuste `index.html`: `lang="pt-BR"` e remova estilos mortos (`.file-input-button` não é usado).
5. Adicione ESLint (flat config) + Prettier com as regras recomendadas de React/TypeScript e corrija o que apontarem.
6. Adicione `vitest` com testes para: (a) o parsing/validação da resposta da IA, incluindo resposta válida, seção malformada e JSON inválido; (b) o mapeamento de exportação Excel — cenário com tickets, cenário só com itens de resíduo (verificando as novas colunas preenchidas), conversão toneladas→kg e formatação do código IBAMA `XX XX XX (*)`. Adicione scripts `lint` e `test` ao `package.json`.
7. Atualize o `README.md`: descrição real do projeto em português, arquitetura (frontend + função Vercel), variáveis de ambiente necessárias (`GEMINI_API_KEY`, `GEMINI_MODEL` opcional), como rodar localmente com `vercel dev` (necessário para a função `/api`), e como rodar lint/testes.

## Verificação final

- `npm run build`, `npm run lint` e `npm test` devem passar.
- Confirme que nenhuma referência a `pdfjs-dist`, `xlsx` ou `cdn.tailwindcss.com` sobrou.
- Confirme com `git grep GEMINI_API_KEY` que a chave só é lida em código de servidor (`api/`).
- Liste ao final o que foi feito em cada fase e qualquer decisão tomada que divergiu deste plano, com justificativa.
