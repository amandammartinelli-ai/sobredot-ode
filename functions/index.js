/**
 * Ponto de entrada das Cloud Functions da Sobredot.
 *
 * Cada ficheiro em src/ agrupa uma responsabilidade (ver comentários em
 * cada um): família, concessões de acesso, auditoria, administração. O
 * cofre de documentos e o gateway de IA (Etapa 3) vivem em
 * src/documents.js e src/ai.js.
 */
const family = require('./src/family');
const access = require('./src/access');
const adminClaims = require('./src/adminClaims');
const audit = require('./src/audit');
const documents = require('./src/documents');
const ai = require('./src/ai');
const insights = require('./src/insights');
const reports = require('./src/reports');
const dataRights = require('./src/dataRights');
const adminDashboard = require('./src/adminDashboard');

// Exportação explícita: só funções Cloud Functions reais (callables e
// gatilhos). Utilitários puros (ex.: containsBlockedIntent,
// sanitizeUntrustedText, retrieveChildContext, buildGroundedAnswer,
// writeAuditEvent) ficam disponíveis para testes através do require
// direto do respetivo módulo em src/ — não são "funções" implantáveis e
// não pertencem aqui.
module.exports = {
  // família
  createFamily: family.createFamily,
  inviteFamilyMember: family.inviteFamilyMember,
  acceptFamilyInvite: family.acceptFamilyInvite,
  removeFamilyMember: family.removeFamilyMember,
  getFamilyMemberNames: family.getFamilyMemberNames,
  // concessões de acesso
  createAccessGrant: access.createAccessGrant,
  acceptAccessGrant: access.acceptAccessGrant,
  revokeAccessGrant: access.revokeAccessGrant,
  onAccessGrantWrite: access.onAccessGrantWrite,
  cleanupExpiredGrants: access.cleanupExpiredGrants,
  // administração
  onUserCreate: adminClaims.onUserCreate,
  setAdminClaim: adminClaims.setAdminClaim,
  logLoginEvent: adminClaims.logLoginEvent,
  // auditoria (gatilhos)
  onChildWrite: audit.onChildWrite,
  onRecordWrite: audit.onRecordWrite,
  onDocumentMetaWrite: audit.onDocumentMetaWrite,
  // cofre de documentos
  onDocumentUpload: documents.onDocumentUpload,
  approveDocument: documents.approveDocument,
  rejectDocument: documents.rejectDocument,
  getDocumentUploadUrl: documents.getDocumentUploadUrl,
  getDocumentDownloadUrl: documents.getDocumentDownloadUrl,
  purgeExpiredDocuments: documents.purgeExpiredDocuments,
  // gateway de IA
  askDocuments: ai.askDocuments,
  // Inteligência Integrada (Etapa 4)
  generateInsights: insights.generateInsights,
  setInsightStatus: insights.setInsightStatus,
  // relatórios e partilha controlada
  generateReport: reports.generateReport,
  createReportShareLink: reports.createReportShareLink,
  revokeReportShareLink: reports.revokeReportShareLink,
  getSharedReport: reports.getSharedReport,
  // direitos da família (Etapa 5)
  exportFamilyData: dataRights.exportFamilyData,
  setChildProcessingRestriction: dataRights.setChildProcessingRestriction,
  requestFamilyDeletion: dataRights.requestFamilyDeletion,
  cancelFamilyDeletion: dataRights.cancelFamilyDeletion,
  processScheduledDeletions: dataRights.processScheduledDeletions,
  purgeOldTechnicalLogs: dataRights.purgeOldTechnicalLogs,
  // painel administrativo (Etapa 5)
  getOperationalSummary: adminDashboard.getOperationalSummary,
};
