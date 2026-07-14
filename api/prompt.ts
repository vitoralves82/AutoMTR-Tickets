import type { DocumentType } from '../types';

// Prompts de extração. Mantidos no servidor para que o cliente não possa
// substituí-los (o endpoint não aceita prompt arbitrário).

const MTR_EXTRACTION_PROMPT = `Your task is to analyze the provided MTR (Manifesto de Transporte de Resíduos) document images and extract all information into a single, valid JSON array.

The final output MUST be a single JSON array, where each element is an object representing a section of the document.

Each section object must have the following structure:
{
  "sectionTitle": "The title of the section, e.g., 'Identificação do Gerador'",
  "fields": [
    { "topic": "The label of the data point", "answer": "The extracted value" },
    { "topic": "Another label", "answer": "Another value" }
  ]
}

Follow these specific instructions for certain sections:

1.  **Cabeçalho do Documento**: Create a section with this title. It should include fields for "Título do Documento" and "MTR n°".

2.  **Identificação dos Resíduos**:
    - If there are multiple waste items, create a new item starting with a field like \`{"topic": "Item Nº", "answer": "1"}\`.
    - Split "Código IBAMA e Denominação" into two separate fields: one for "Código IBAMA" and one for "Denominação".
    - Also extract "Estado Físico", "Classe", "Acondicionamento", "Qtde", "Unidade", and "Tecnologia de Tratamento" for each item.

3.  **TICKETS**:
    - If any image is a weighing ticket ("Bilhete de Pesagem"), create a section with the title "TICKETS".
    - For each ticket found, add a field for its net weight. The topic should be "Peso Líquido (Ticket 1)", "Peso Líquido (Ticket 2)", and so on.

The order of sections should follow the logical flow of the document.

Here is a complete example of the expected final JSON array structure:
[
  {
    "sectionTitle": "Cabeçalho do Documento",
    "fields": [
      { "topic": "Título do Documento", "answer": "Manifesto de Transporte de Resíduos" },
      { "topic": "MTR n°", "answer": "2113238175" }
    ]
  },
  {
    "sectionTitle": "Identificação do Gerador",
    "fields": [
      { "topic": "Razão Social", "answer": "134218 - EQUINOR BRASIL ENERGIA LTDA" },
      { "topic": "Endereço", "answer": "Rua General Sampaio, n.00004" }
    ]
  },
  {
    "sectionTitle": "Identificação dos Resíduos",
    "fields": [
        { "topic": "Item Nº", "answer": "1" },
        { "topic": "Código IBAMA", "answer": "180103" },
        { "topic": "Denominação", "answer": "Resíduos de serviços de saúde" },
        { "topic": "Estado Físico", "answer": "Sólido" },
        { "topic": "Classe", "answer": "I" },
        { "topic": "Acondicionamento", "answer": "Saco Plástico" },
        { "topic": "Qtde", "answer": "100" },
        { "topic": "Unidade", "answer": "kg" },
        { "topic": "Tecnologia de Tratamento", "answer": "Incineração" }
    ]
  },
  {
    "sectionTitle": "TICKETS",
    "fields": [
      { "topic": "Peso Líquido (Ticket 1)", "answer": "5400" },
      { "topic": "Peso Líquido (Ticket 2)", "answer": "3250" }
    ]
  }
]`;

const MMR_EXTRACTION_PROMPT = `Your task is to analyze the provided MMR (Manifesto Marítimo de Resíduos / Maritime Waste Manifest) document and extract all information into a single, valid JSON array of sections, using the SAME structure as the MTR extractor (an array of objects, each with "sectionTitle" and "fields", where each field is { "topic", "answer" }).

Be strictly faithful to the text in the document. Do not deduce, infer, or correct information that is not clearly visible. If a field is not present or not legible, use an empty string "".

Produce exactly two sections, in this order:

1. "sectionTitle": "Cabeçalho do MMR" with these fields:
   - "MMR N°"      (control number, e.g. "026/2025")
   - "Data"        (the date associated with the GERADOR, usually on the left of the form; ignore other dates; it may be handwritten or partly hidden by a signature; e.g. "27-fev-25")
   - "Gerador"     (e.g. "VALARIS DS-17")
   - "Transportador" (the transport vessel, e.g. "DELTA COMMANDER")
   - "Base de Apoio" (e.g. "TRIUNFO LOGÍSTICA")
   - "Atividade"   (e.g. "Perfuração")
   - "Bacia"       (e.g. "Bacalhau")
   - "Poço"        (e.g. "WI-5")
   - "Projeto"     (if present)

2. "sectionTitle": "Itens de Resíduo". For EACH row of the waste table, output the fields for that row, starting with { "topic": "Item Nº", "answer": "1" } and then:
   - "Código"           (waste code, e.g. "A009")
   - "Tipo de Resíduo"  (e.g. "Madeira não contaminada")
   - "Descrição"        (e.g. "Non contaminated wood")
   - "Acondicionamento" (e.g. "Lote", "Big Bag")
   - "Quantidade"       (numeric, e.g. "1")
   - "Unidade"          (e.g. "UN")
   - "Peso (Kg)"        (numeric, e.g. "715")
   - "Classe NBR"       (e.g. "IIA")
   - "MTR"              (the MTR number shown on that row, if present)

Do NOT extract RNC (it does not come from the MMR). Extract EVERY row of the waste table. The order of items must follow the order in the document. Return ONLY the JSON array, with no explanations or markdown fences.

Example of the expected final JSON:
[
  {
    "sectionTitle": "Cabeçalho do MMR",
    "fields": [
      { "topic": "MMR N°", "answer": "026/2025" },
      { "topic": "Data", "answer": "27-fev-25" },
      { "topic": "Gerador", "answer": "VALARIS DS-17" },
      { "topic": "Transportador", "answer": "DELTA COMMANDER" },
      { "topic": "Base de Apoio", "answer": "TRIUNFO LOGÍSTICA" },
      { "topic": "Atividade", "answer": "Perfuração" },
      { "topic": "Bacia", "answer": "Bacalhau" },
      { "topic": "Poço", "answer": "WI-5" },
      { "topic": "Projeto", "answer": "" }
    ]
  },
  {
    "sectionTitle": "Itens de Resíduo",
    "fields": [
      { "topic": "Item Nº", "answer": "1" },
      { "topic": "Código", "answer": "A009" },
      { "topic": "Tipo de Resíduo", "answer": "Madeira não contaminada" },
      { "topic": "Descrição", "answer": "Non contaminated wood" },
      { "topic": "Acondicionamento", "answer": "Lote" },
      { "topic": "Quantidade", "answer": "1" },
      { "topic": "Unidade", "answer": "UN" },
      { "topic": "Peso (Kg)", "answer": "715" },
      { "topic": "Classe NBR", "answer": "IIA" },
      { "topic": "MTR", "answer": "2113232195" }
    ]
  }
]`;

const EXTRACTION_PROMPTS: Record<DocumentType, string> = {
  mtr: MTR_EXTRACTION_PROMPT,
  mmr: MMR_EXTRACTION_PROMPT,
};

export const getExtractionPrompt = (documentType: DocumentType): string =>
  EXTRACTION_PROMPTS[documentType];
