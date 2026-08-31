/**
 * Estado de sessão em memória — nunca persistido nem usado para decidir
 * permissões (isso depende sempre das regras do servidor). Serve só para
 * evitar repetir a resolução da família em cada vista, depois de o router
 * já a ter confirmado como guarda de rota.
 */
let familyId = null;

export function setFamilyId(id) {
  familyId = id;
}

export function getFamilyId() {
  return familyId;
}
