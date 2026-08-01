import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

/**
 * Los alias se resuelven por prefijo y en orden, así que los más específicos
 * (`@tl/types/compliance`) deben declararse antes que el genérico (`@tl/types`).
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    globals: false,
  },
  resolve: {
    alias: [
      { find: '@tl/types/plans', replacement: resolve(__dirname, 'src/packages/types/plans.ts') },
      { find: '@tl/types/compliance', replacement: resolve(__dirname, 'src/packages/types/compliance.ts') },
      { find: '@tl/types', replacement: resolve(__dirname, 'src/packages/types/index.ts') },
      { find: /^@tl\/market-data$/, replacement: resolve(__dirname, 'src/packages/market-data/index.ts') },
      { find: '@tl/market-data/', replacement: resolve(__dirname, 'src/packages/market-data/') },
      { find: /^@tl\/simulation-engine$/, replacement: resolve(__dirname, 'src/packages/simulation-engine/index.ts') },
      { find: '@tl/simulation-engine/', replacement: resolve(__dirname, 'src/packages/simulation-engine/') },
      { find: /^@tl\/ai$/, replacement: resolve(__dirname, 'src/packages/ai/index.ts') },
      { find: '@tl/ai/', replacement: resolve(__dirname, 'src/packages/ai/') },
      { find: '@tl/ads', replacement: resolve(__dirname, 'src/packages/ads/index.ts') },
      { find: '@tl/analytics', replacement: resolve(__dirname, 'src/packages/analytics/index.ts') },
      { find: '@/', replacement: resolve(__dirname, 'src/') },
    ],
  },
});
