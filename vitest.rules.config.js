import { defineConfig } from 'vitest/config';

// Configuração à parte para os testes de regras (Firestore/Storage): correm
// em Node (não jsdom) e só fazem sentido com o Firebase Emulator Suite
// ativo — ver "test:rules" no package.json e docs/firebase-setup.md.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.js'],
    hookTimeout: 30000,
    testTimeout: 20000,
    // Todos os ficheiros partilham a MESMA instância do Firestore Emulator
    // (um único projeto). Alguns testes chamam clearFirestore(), que apaga
    // TODA a base de dados do projeto — correr ficheiros em paralelo faria
    // um ficheiro apagar os dados que outro acabou de semear. Correr em
    // série elimina essa fonte de instabilidade.
    fileParallelism: false,
  },
});
