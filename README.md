# AutoMTR & Tickets

[Português](#português) | [English](#english)

---

## Português

Aplicação web para extrair automaticamente as informações de documentos **MTR
(Manifesto de Transporte de Resíduos)**, **MMR (Manifesto Marítimo de
Resíduos)** e **tickets de pesagem** usando IA, e exportá-las para uma
planilha Excel.

Envie os documentos (PDF ou imagem), a aplicação envia ao modelo do Google
Gemini, que devolve os dados estruturados em seções e campos. O resultado é
exibido em tabelas e pode ser exportado para `.xlsx` — no layout "Controle de
MTRs" para MTR, ou no layout de rastreabilidade para MMR.

### Arquitetura

- **Frontend**: React 19 + Vite + Tailwind CSS. Faz o upload dos arquivos, exibe
  a pré-visualização, as tabelas de resultado e gera o Excel (via `exceljs`,
  carregado sob demanda).
- **Backend**: função serverless da Vercel em `api/analyze.ts`. É ela que detém
  os prompts de extração e a chave de API do Gemini — o cliente **nunca** vê a
  chave nem consegue enviar um prompt arbitrário. Valida o corpo da requisição
  (tipo de documento, formatos aceitos, quantidade e tamanho dos arquivos)
  antes de chamar a IA.
- **IA**: Google Gemini via `@google/genai`, com _structured output_
  (`responseSchema`) para garantir o formato da resposta. PDFs são enviados
  nativamente ao modelo (sem rasterização no navegador).

```
Navegador (React)  ──POST /api/analyze──▶  Função Vercel  ──▶  Gemini
   arquivos + tipo de documento             prompt + chave        (PDF/imagem)
```

### Tipos de documento suportados

| Tipo | Descrição | Aba do Excel |
| ---- | --------- | ------------ |
| **MTR** | Manifesto de Transporte de Resíduos | "Controle de MTRs" (32 colunas) |
| **MMR** | Manifesto Marítimo de Resíduos | "Rastreabilidade" (20 colunas) |

O tipo de documento é escolhido na tela inicial, antes do upload, e determina
tanto o prompt de extração usado pela IA quanto o layout do Excel gerado.

### Variáveis de ambiente

Crie um arquivo `.env.local` (não versionado) a partir do `.env.example`:

| Variável         | Obrigatória | Descrição                                                        |
| ---------------- | ----------- | ---------------------------------------------------------------- |
| `GEMINI_API_KEY` | Sim         | Chave da API do Google Gemini (usada apenas no servidor).        |
| `GEMINI_MODEL`   | Não         | Modelo a usar. Padrão: `gemini-3.5-flash`.                       |

Em produção (Vercel), configure essas variáveis em **Project Settings →
Environment Variables**.

### Rodando localmente

**Pré-requisitos:** Node.js 20+ e a [CLI da Vercel](https://vercel.com/docs/cli)
(necessária para executar a função em `api/` localmente).

```bash
npm install
# configure sua chave em .env.local (veja .env.example)
vercel dev
```

> `npm run dev` sobe apenas o frontend (Vite) e **não** executa a função
> `/api/analyze`; use `vercel dev` para testar o fluxo completo de análise.

### Scripts

| Script              | O que faz                                       |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Sobe o frontend em modo de desenvolvimento.     |
| `npm run build`     | Build de produção.                              |
| `npm run preview`   | Servir o build de produção localmente.          |
| `npm run lint`      | ESLint em todo o projeto.                       |
| `npm run format`    | Formata o código com Prettier.                  |
| `npm run test`      | Roda os testes (Vitest).                        |
| `npm run typecheck` | Checagem de tipos com o TypeScript.             |

### Testes

Os testes cobrem as funções puras mais importantes do domínio:

- `services/responseParser.ts` — validação da resposta da IA.
- `services/excelExport.ts` — mapeamento dos dados de MTR para as linhas da
  planilha "Controle de MTRs" (cenário com tickets, cenário só com itens,
  conversão de toneladas e formatação do código IBAMA).
- `services/mmrExcelExport.ts` — mapeamento dos dados de MMR para as linhas da
  planilha "Rastreabilidade" (vários itens, cabeçalho repetido por linha,
  coluna RNC vazia e caso sem itens).

```bash
npm test
```

### Formatos aceitos

PDF, JPG, PNG e WEBP — no máximo 10 arquivos por análise, respeitando o limite
de tamanho de payload da função serverless (~4 MB).

---

## English

Web application that automatically extracts information from **MTR**
(Manifesto de Transporte de Resíduos — Brazilian waste transport manifest),
**MMR** (Manifesto Marítimo de Resíduos — maritime waste manifest) and
**weighing ticket** documents using AI, exporting the result to an Excel
spreadsheet.

Upload the documents (PDF or image); the app sends them to the Google Gemini
model, which returns the extracted data as structured sections and fields.
Results are shown as tables and can be exported to `.xlsx` — using the
"Controle de MTRs" layout for MTR, or the traceability layout for MMR.

### Architecture

- **Frontend**: React 19 + Vite + Tailwind CSS. Handles file upload, preview,
  results tables, and generates the Excel file (via `exceljs`, lazy-loaded).
- **Backend**: a Vercel serverless function at `api/analyze.ts`. It owns the
  extraction prompts and the Gemini API key — the client **never** sees the
  key nor can send an arbitrary prompt. It validates the request body
  (document type, accepted formats, file count and size) before calling the AI.
- **AI**: Google Gemini via `@google/genai`, using _structured output_
  (`responseSchema`) to guarantee the response shape. PDFs are sent natively
  to the model (no client-side rasterization).

### Supported document types

| Type | Description | Excel sheet |
| ---- | ----------- | ----------- |
| **MTR** | Waste transport manifest | "Controle de MTRs" (32 columns) |
| **MMR** | Maritime waste manifest | "Rastreabilidade" (20 columns) |

The document type is chosen on the initial screen, before upload, and
determines both the extraction prompt used by the AI and the generated Excel
layout.

### Environment variables

Create a `.env.local` file (not versioned) based on `.env.example`:

| Variable         | Required | Description                                              |
| ---------------- | -------- | ---------------------------------------------------------- |
| `GEMINI_API_KEY` | Yes      | Google Gemini API key (server-side only).                  |
| `GEMINI_MODEL`   | No       | Model to use. Default: `gemini-3.5-flash`.                 |

In production (Vercel), set these under **Project Settings → Environment
Variables**.

### Running locally

**Requirements:** Node.js 20+ and the [Vercel CLI](https://vercel.com/docs/cli)
(needed to run the `api/` function locally).

```bash
npm install
# set your key in .env.local (see .env.example)
vercel dev
```

> `npm run dev` only runs the frontend (Vite) and does **not** execute the
> `/api/analyze` function; use `vercel dev` to test the full analysis flow.

### Scripts

| Script               | What it does                        |
| -------------------- | ------------------------------------ |
| `npm run dev`        | Starts the frontend in dev mode.     |
| `npm run build`      | Production build.                    |
| `npm run preview`    | Serves the production build locally. |
| `npm run lint`       | Runs ESLint across the project.      |
| `npm run format`     | Formats the code with Prettier.      |
| `npm run test`       | Runs the tests (Vitest).             |
| `npm run typecheck`  | TypeScript type checking.            |

### Tests

Tests cover the domain's most important pure functions:

- `services/responseParser.ts` — AI response validation.
- `services/excelExport.ts` — MTR data mapping to the "Controle de MTRs" rows
  (ticket scenario, waste-item-only scenario, ton conversion, IBAMA code
  formatting).
- `services/mmrExcelExport.ts` — MMR data mapping to the "Rastreabilidade" rows
  (multiple items, header repeated per row, empty RNC column, and no-items
  case).

```bash
npm test
```

### Accepted formats

PDF, JPG, PNG and WEBP — up to 10 files per analysis, respecting the
serverless function's payload size limit (~4 MB).
