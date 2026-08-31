import { defineConfig } from 'vite';

// Vite é usado apenas como ferramenta de desenvolvimento e build.
// A saída continua a ser HTML/CSS/JS puro, sem frameworks de UI.
export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true
  },
  server: {
    port: 5173,
    open: false
  },
  preview: {
    port: 4173
  },
  test: {
    environment: 'jsdom',
    // tests/rules/** precisa do Firebase Emulator Suite a correr e tem o
    // seu próprio comando (npm run test:rules) — ver package.json e
    // docs/firebase-setup.md.
    include: ['tests/unit/**/*.test.js']
  }
});
