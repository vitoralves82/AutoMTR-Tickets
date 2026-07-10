# Análise do Repositório — AutoMTR & Tickets

*Análise realizada em 10/07/2026. Último commit do projeto: 16/07/2025.*

## O que o projeto é

SPA em React 19 + Vite que recebe documentos MTR (Manifesto de Transporte de Resíduos)
e tickets de pesagem (PDF/imagem), rasteriza PDFs no navegador com `pdfjs-dist`, envia
as imagens para uma função serverless da Vercel (`api/analyze.ts`) que chama o Gemini
(`gemini-2.5-flash`) para extração estruturada, exibe o resultado em tabelas e exporta
para Excel (`xlsx`) no layout "Controle de MTRs". Projeto gerado originalmente no
Google AI Studio.

**Tamanho:** ~900 linhas de código útil, 13 arquivos. O `App.tsx` (830 linhas) concentra
quase tudo.

## Veredito: aproveitar e reformular — não recriar do zero

O valor real do projeto não está no código de UI (que é genérico e fácil de refazer),
e sim em duas coisas difíceis de recriar:

1. **O prompt de extração** — já ajustado para a estrutura real de MTRs brasileiros
   (seções, itens de resíduo, código IBAMA separado de denominação, tickets de pesagem).
2. **As regras de negócio da exportação Excel** — os 32 cabeçalhos do "Controle de MTRs",
   normalização de razão social, conversão t→kg, formatação do código de resíduo
   `XX XX XX (*)`, lógica de uma linha por ticket vs. uma linha por item.

A arquitetura base (Vite + React + função serverless na Vercel) continua atual em 2026.
Recriar do zero jogaria fora o ajuste fino de domínio e entregaria essencialmente a
mesma arquitetura. O custo de modernizar é baixo: o projeto inteiro cabe em uma sessão
de refatoração.

## Problemas encontrados

### Críticos (segurança)

| # | Problema | Onde |
|---|----------|------|
| 1 | **Endpoint é um proxy aberto para o Gemini.** `api/analyze.ts` aceita `promptText` arbitrário vindo do cliente e o executa com a chave de API do servidor, sem autenticação, rate limiting ou verificação de origem. Qualquer pessoa que descubra a URL pode consumir sua cota do Gemini para qualquer finalidade. | `api/analyze.ts:17`, `services/geminiService.ts:13-16` |
| 2 | **Chave de API injetada no bundle do cliente.** `vite.config.ts` define `process.env.GEMINI_API_KEY` via `define`, embutindo o valor no JavaScript público se a variável existir no build. Hoje nenhum código do frontend a usa (resquício da versão pré-serverless), mas é uma armadilha armada. | `vite.config.ts:7-10` |

### Altos (quebram o uso real)

| # | Problema | Onde |
|---|----------|------|
| 3 | **Limite de payload da Vercel (4,5 MB).** As imagens vão em base64 no corpo do POST. Um PDF de 5 páginas rasterizado a scale 1.5 / JPEG 0.85, ou vários arquivos, estoura o limite → erro 413 sem tratamento amigável. | `App.tsx`, `api/analyze.ts` |
| 4 | **GIF e BMP são aceitos no upload mas o Gemini não os suporta** (aceita PNG, JPEG, WEBP, HEIC, HEIF) → erro de API em runtime. | `App.tsx:183`, `App.tsx:704` |
| 5 | **PDFs truncados silenciosamente em 5 páginas** (`Math.min(pdf.numPages, 5)`), sem aviso ao usuário. Um MTR + tickets com mais páginas perde dados sem ninguém perceber. | `App.tsx:132` |
| 6 | **Exportação Excel descarta dados que a IA extraiu.** Os cabeçalhos `Tipo de Resíduo`, `Classe NBR 10.004`, `Acondicionamento` e `Forma de Tratamento / Destinação final` existem na planilha, e o prompt extrai `Denominação`, `Classe`, `Acondicionamento` e `Tecnologia de Tratamento` — mas o mapeamento nunca é feito; as colunas saem vazias. Campos antes do primeiro `Item Nº` também são descartados (`currentItem` nulo). | `App.tsx:414-523` |

### Médios

| # | Problema | Onde |
|---|----------|------|
| 7 | **Estado stale / efeito colateral no parsing.** `handleAnalyzeClick` lê `errorMessage` da closure logo após `setErrorMessage(null)` — a lógica de limpeza de erro (linhas 343-345) opera sobre valor desatualizado e é efetivamente morta. `parseGeminiResponse` também faz `setErrorMessage` como efeito colateral interno. | `App.tsx:246-309`, `App.tsx:343` |
| 8 | **`xlsx` 0.18.5 com CVEs conhecidas** (prototype pollution CVE-2023-30533, ReDoS CVE-2024-22363). A versão do npm está abandonada; correções só existem fora do npm. Migrar para `exceljs`. | `package.json` |
| 9 | **JSON "na fé" em vez de structured output.** Usa `responseMimeType: "application/json"` mas sem `responseSchema` — daí todo o parsing defensivo, remoção de cercas ` ``` ` e normalização de formatos alternativos no cliente. Com schema, o Gemini garante a estrutura. | `api/analyze.ts:50-52`, `App.tsx:246-309` |
| 10 | **Duplo escape de HTML.** `escapeHtml()` é chamado dentro de JSX (React já escapa) — um título com `&` renderiza como `&amp;` na tela. | `App.tsx:599,628,631,643,645,748,757` |
| 11 | **Sem timeout configurado na função serverless** (`maxDuration`). Chamada multimodal com várias imagens pode exceder o limite do plano e cair em 504. | `api/analyze.ts` |

### Baixos / dívida técnica

- **Tailwind via CDN** (`cdn.tailwindcss.com`) — não recomendado para produção; instalar como dependência com purge.
- **Imagem de fundo hotlinked** de `environpact.com` — dependência externa que pode sumir.
- `<html lang="en">` para um app 100% em português.
- Prompt gigante (65 linhas) declarado dentro do corpo do componente.
- `App.tsx` monolítico; sem componentes, sem testes, sem ESLint/Prettier, sem CI, sem Error Boundary.
- Contador de "tempo economizado" usa estimativa fixa de 20 min/PDF — cosmético, ok.
- `.env.local` está versionado (só com placeholder — sem vazamento real no histórico, verificado), mas deveria sair do controle de versão (`git rm --cached`).

## Oportunidades de modernização (as que mais mudam o jogo)

1. **Enviar o PDF direto ao Gemini.** O Gemini aceita PDF nativamente (`inlineData` com
   `application/pdf`, ou Files API para arquivos grandes). Isso **elimina** a rasterização
   client-side, o `pdfjs-dist` inteiro, o limite de 5 páginas e melhora a qualidade da
   extração (o modelo enxerga o texto nativo do PDF em vez de um raster 1.5x).
2. **Structured output com `responseSchema`** — apaga ~70 linhas de parsing defensivo.
3. **Modelo mais atual.** `gemini-2.5-flash` ainda funciona, mas a família Gemini 3 (lançada
   no fim de 2025) tem opções melhores de custo/qualidade para extração de documentos —
   verificar modelos disponíveis na data da migração. Alternativa: API da Anthropic
   (Claude também lê PDFs nativamente com `document` content block).
4. **Fechar o endpoint:** prompt fixo no servidor, validação de payload (zod), limite de
   tamanho/quantidade, e alguma proteção (Vercel firewall/rate limit, ou autenticação
   simples se o uso é interno).
5. **Qualidade de base:** dividir `App.tsx` em componentes + hooks, Tailwind instalado,
   `exceljs`, ESLint + Prettier, testes (vitest) para o parsing e o mapeamento Excel —
   essas duas funções são puras e fáceis de testar.

## Estimativa

Todo o plano acima cabe em **1 a 2 sessões de trabalho com um agente** (o prompt pronto
está em `docs/PROMPT_SONNET.md`). Um rebuild do zero custaria mais e terminaria no mesmo
lugar, com o risco de regredir as regras de negócio do Excel.
