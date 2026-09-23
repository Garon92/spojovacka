/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import { g92Pwa } from './src/kit/pwa.ts';

export default defineConfig({
  base: '/spojovacka/',
  server: { port: 5177, strictPort: true },
  preview: { port: 5177, strictPort: true },
  build: { target: 'es2022', sourcemap: false },
  plugins: [VitePWA(g92Pwa('spojovacka'))],
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
