/**
 * Extração de texto e extração estruturada.
 *
 * Duas responsabilidades bem separadas, de propósito:
 *
 *  - `extractPagesFromBuffer` (IMPURA): obtém o texto por página de um
 *    PDF (pdf-parse) ou DOCX (mammoth) reais. Ficheiros de imagem não têm
 *    camada de texto — precisam de OCR, tratado à parte (ver ocr.js), e
 *    esta função devolve `ocrRequired: true` em vez de inventar texto.
 *
 *  - `extractStructuredItemsFromPages` (PURA, testável sem I/O): deteta,
 *    por cabeçalhos conhecidos em português, as secções do esquema pedido
 *    (pontos fortes, necessidades, observações, resultados de avaliação,
 *    recomendações, estratégias, metas, adaptações escolares, aspetos
 *    sensoriais, comunicação, sono, alimentação, informação de
 *    medicação, datas, profissional responsável, limitações). É uma
 *    heurística baseada em texto — não é um modelo de linguagem — e por
 *    isso NUNCA inventa uma categoria que não tenha sido encontrada no
 *    texto: sem correspondência, não há item. Ver docs/vendors.md para o
 *    plano de substituição por um classificador mais rico no futuro.
 */
const pdfParseModule = require('pdf-parse');
const mammoth = require('mammoth');

const PDFParse = pdfParseModule.PDFParse || pdfParseModule;

const SECTION_PATTERNS = [
  { category: 'strengths', pattern: /pontos?\s+fortes?/i },
  { category: 'needs', pattern: /necessidades?/i },
  { category: 'observations', pattern: /observaç(ões|ão)/i },
  { category: 'assessmentResults', pattern: /resultados?\s+d[ae]\s+avaliaç(ão|ões)/i },
  { category: 'recommendations', pattern: /recomendaç(ões|ão)/i },
  { category: 'strategies', pattern: /estratégias?/i },
  { category: 'goals', pattern: /metas|objetivos/i },
  { category: 'schoolAdaptations', pattern: /adapta(ções|ção)\s+escolar(es)?/i },
  { category: 'sensory', pattern: /sensorial(idade)?/i },
  { category: 'communication', pattern: /comunicaç(ão|ões)/i },
  { category: 'sleep', pattern: /\bsono\b/i },
  { category: 'food', pattern: /alimentaç(ão|ões)/i },
  { category: 'medicationInfo', pattern: /medicaç(ão|ões)|medicamentos?/i },
  { category: 'dates', pattern: /\bdatas?\b/i },
  { category: 'responsibleProfessional', pattern: /profissional\s+respons[áa]vel|t[ée]cnic[oa]\s+respons[áa]vel|assinad[oa]\s+por/i },
  { category: 'limitations', pattern: /limita(ções|ção)/i },
];

const MAX_EXCERPT_LENGTH = 300;
const MAX_VALUE_LENGTH = 1500;

function looksLikeHeading(line) {
  const trimmed = line.trim();
  if (trimmed.length === 0 || trimmed.length > 80) return false;
  // Cabeçalhos costumam terminar em ':' ou estarem sozinhos numa linha curta.
  return /:$/.test(trimmed) || trimmed === trimmed.toUpperCase();
}

/**
 * Extrai itens estruturados de um conjunto de páginas já em texto simples.
 * `pages` é `Array<{ num: number, text: string }>`.
 */
function extractStructuredItemsFromPages(pages) {
  const items = [];

  pages.forEach((page) => {
    const lines = String(page.text || '').split(/\r?\n/);

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const match = SECTION_PATTERNS.find(({ pattern }) => pattern.test(line) && looksLikeHeading(line));
      if (!match) continue;

      // Junta as linhas seguintes até à próxima linha vazia dupla ou até ao
      // próximo cabeçalho reconhecido.
      const collected = [];
      let j = i + 1;
      while (j < lines.length) {
        const nextLine = lines[j];
        const isAnotherHeading = SECTION_PATTERNS.some(
          ({ pattern }) => pattern.test(nextLine) && looksLikeHeading(nextLine)
        );
        if (isAnotherHeading) break;
        if (nextLine.trim() === '' && collected.length > 0 && collected[collected.length - 1].trim() === '') break;
        collected.push(nextLine);
        j += 1;
      }

      const value = collected.join(' ').replace(/\s+/g, ' ').trim().slice(0, MAX_VALUE_LENGTH);
      if (value.length === 0) continue;

      items.push({
        category: match.category,
        value,
        page: page.num,
        excerpt: value.slice(0, MAX_EXCERPT_LENGTH),
        // Confiança heurística simples: um pouco mais alta quando o
        // cabeçalho é claramente demarcado (termina em ':').
        confidence: /:$/.test(line.trim()) ? 0.7 : 0.55,
      });

      i = j - 1;
    }
  });

  return items;
}

async function extractPagesFromPdf(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return { pages: result.pages.map((p) => ({ num: p.num, text: p.text })), ocrRequired: false };
  } finally {
    if (typeof parser.destroy === 'function') {
      await parser.destroy();
    }
  }
}

async function extractPagesFromDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return { pages: [{ num: 1, text: result.value }], ocrRequired: false };
}

/**
 * Ponto de entrada da extração de texto. `realMimeType` deve vir SEMPRE de
 * `contentSniff.detectRealMimeType`, nunca do valor declarado pelo
 * cliente.
 */
async function extractPagesFromBuffer(buffer, realMimeType) {
  if (realMimeType === 'application/pdf') {
    return extractPagesFromPdf(buffer);
  }
  if (realMimeType === 'application/zip') {
    // DOCX é um ZIP por dentro — já validámos a assinatura real antes de
    // chegar aqui (ver documents.js).
    return extractPagesFromDocx(buffer);
  }
  if (realMimeType === 'image/jpeg' || realMimeType === 'image/png') {
    // Imagens não têm camada de texto: precisam sempre de OCR.
    return { pages: [], ocrRequired: true };
  }
  return { pages: [], ocrRequired: false, unsupported: true };
}

module.exports = { extractPagesFromBuffer, extractStructuredItemsFromPages, SECTION_PATTERNS };
