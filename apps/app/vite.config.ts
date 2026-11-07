import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // caminhos relativos: o mesmo build serve no Tauri (M2) e numa prévia publicada
  base: './',
  server: { port: 5180, strictPort: true },
  preview: { port: 4180, strictPort: true },
  build: { target: 'es2022' },
  test: { include: ['src/**/*.test.{ts,tsx}'] },
});
