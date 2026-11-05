// Vitest config (npm test). Aliases mirror client/vite.config.js so Phaser-free client modules
// (client/src/game/art/*) can be imported next to shared/ code. Tests live in tests/ only.
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '@': fileURLToPath(new URL('./client/src', import.meta.url)),
    },
  },
  test: {
    include: ['tests/**/*.test.js'],
    environment: 'node',
  },
});
