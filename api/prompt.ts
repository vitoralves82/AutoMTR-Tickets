// Prompt de extração dos documentos MTR. Mantido no servidor para que o cliente
// não possa substituí-lo (o endpoint deixou de aceitar prompt arbitrário).
export const EXTRACTION_PROMPT = `Your task is to analyze the provided MTR (Manifesto de Transporte de Resíduos) document images and extract all information into a single, valid JSON array.

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
