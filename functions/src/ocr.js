/**
 * Interface de OCR — para imagens e PDFs digitalizados sem camada de
 * texto. Tal como o antivírus (ver antivirus.js), esta etapa não liga a
 * nenhum motor de OCR real: em vez de simular resultados, o documento
 * fica no estado "erro" com `errorReason: 'ocr_unavailable'`, visível na
 * interface, e só pode avançar por correção manual (o responsável pode
 * transcrever a informação relevante como um registo/observação comum, o
 * que não é o mesmo que "o sistema leu o documento").
 *
 * Para ligar um motor real (ex.: Cloud Vision API, Document AI): implemente
 * `recognizeText(buffer)` devolvendo `{ pages: [{num, text}] }` e
 * substitua `getOcrAdapter()`.
 */

class UnavailableOcrAdapter {
  // eslint-disable-next-line class-methods-use-this
  async recognizeText() {
    return {
      available: false,
      pages: [],
      reason: 'Nenhum motor de OCR está configurado nesta implantação.',
    };
  }
}

function getOcrAdapter() {
  return new UnavailableOcrAdapter();
}

module.exports = { getOcrAdapter, UnavailableOcrAdapter };
