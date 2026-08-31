/**
 * Deteção do tipo REAL de um ficheiro pelos primeiros bytes ("magic
 * numbers"), em vez de confiar na extensão ou no contentType declarado
 * pelo cliente (que são triviais de falsificar). Ver docs/data-model.md,
 * "verificação de conteúdo real".
 *
 * Cobertura suficiente para os tipos aceites nesta etapa: PDF, JPEG, PNG e
 * DOCX (que é, internamente, um ficheiro ZIP com uma estrutura própria —
 * aqui distinguimos apenas "é um ZIP", que é o necessário para recusar
 * ficheiros que não sejam sequer um contentor válido).
 */

const SIGNATURES = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  // DOCX/ZIP
  { mime: 'application/zip', bytes: [0x50, 0x4b, 0x03, 0x04] },
];

function matchesSignature(buffer, signature) {
  if (buffer.length < signature.bytes.length) return false;
  return signature.bytes.every((byte, index) => buffer[index] === byte);
}

/**
 * Devolve o mime real detetado ('application/pdf', 'image/jpeg',
 * 'image/png', 'application/zip' — usado para DOCX) ou null se não
 * corresponder a nenhuma assinatura conhecida.
 */
function detectRealMimeType(buffer) {
  const match = SIGNATURES.find((signature) => matchesSignature(buffer, signature));
  return match ? match.mime : null;
}

/**
 * Confirma que o tipo declarado pelo cliente é compatível com o tipo real
 * detetado nos bytes. DOCX declara-se como
 * "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
 * mas os bytes reais são sempre um ZIP — por isso aceitamos esse caso
 * especial.
 */
function declaredTypeMatchesReal(declaredMime, realMime) {
  if (!realMime) return false;
  if (declaredMime === realMime) return true;
  if (
    declaredMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' &&
    realMime === 'application/zip'
  ) {
    return true;
  }
  return false;
}

module.exports = { detectRealMimeType, declaredTypeMatchesReal };
