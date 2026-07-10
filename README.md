# AutoMTR & Tickets

Aplicação web para extrair automaticamente as informações de documentos **MTR
(Manifesto de Transporte de Resíduos)** e **tickets de pesagem** usando IA, e
exportá-las para uma planilha Excel no layout "Controle de MTRs".

Envie os documentos (PDF ou imagem), a aplicação envia ao modelo do Google
Gemini, que devolve os dados estruturados em seções e campos. O resultado é
exibido em tabelas e pode ser exportado para `.xlsx`.

## Arquitetura

- **Frontend**: React 19 + Vite + Tailwind CSS. Faz o upload dos arquivos, exibe
  a pré-visualização, as tabelas de resultado e gera o Excel (via `exceljs`,
  carregado sob demanda).
- **Backend**: função serverless da Vercel em `api/analyze.ts`. É ela que detém
  o prompt de extração e a chave de API do Gemini — o cliente **nunca** vê a
  chave nem consegue enviar um prompt arbitrário. Valida o corpo da requisição
  (formatos aceitos, quantidade e tamanho dos arquivos) antes de chamar a IA.
- **IA**: Google Gemini via `@google/genai`, com _structured output_
  (`responseSchema`) para garantir o formato da resposta. PDFs são enviados
  nativamente ao modelo (sem rasterização no navegador).

```
Navegador (React)  ──POST /api/analyze──▶  Função Vercel  ──▶  Gemini
   arquivos base64                          prompt + chave        (PDF/imagem)
```

## Variáveis de ambiente

Crie um arquivo `.env.local` (não versionado) a partir do `.env.example`:

| Variável         | Obrigatória | Descrição                                                        |
| ---------------- | ----------- | ---------------------------------------------------------------- |
| `GEMINI_API_KEY` | Sim         | Chave da API do Google Gemini (usada apenas no servidor).        |
| `GEMINI_MODEL`   | Não         | Modelo a usar. Padrão: `gemini-3.5-flash`.                       |

Em produção (Vercel), configure essas variáveis em **Project Settings →
Environment Variables**.

## Rodando localmente

**Pré-requisitos:** Node.js 20+ e a [CLI da Vercel](https://vercel.com/docs/cli)
(necessária para executar a função em `api/` localmente).

```bash
npm install
# configure sua chave em .env.local (veja .env.example)
vercel dev
```

> `npm run dev` sobe apenas o frontend (Vite) e **não** executa a função
> `/api/analyze`; use `vercel dev` para testar o fluxo completo de análise.

## Scripts

| Script              | O que faz                                       |
| ------------------- | ----------------------------------------------- |
| `npm run dev`       | Sobe o frontend em modo de desenvolvimento.     |
| `npm run build`     | Build de produção.                              |
| `npm run preview`   | Servir o build de produção localmente.          |
| `npm run lint`      | ESLint em todo o projeto.                       |
| `npm run format`    | Formata o código com Prettier.                  |
| `npm run test`      | Roda os testes (Vitest).                        |
| `npm run typecheck` | Checagem de tipos com o TypeScript.             |

## Testes

Os testes cobrem as duas funções puras mais importantes do domínio:

- `services/responseParser.ts` — validação da resposta da IA.
- `services/excelExport.ts` — mapeamento dos dados para as linhas da planilha
  (cenário com tickets, cenário só com itens, conversão de toneladas e
  formatação do código IBAMA).

```bash
npm test
```

## Formatos aceitos

PDF, JPG, PNG e WEBP — no máximo 10 arquivos por análise, respeitando o limite
de tamanho de payload da função serverless (~4 MB).
