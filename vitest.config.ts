import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Exclude E2E Playwright tests in /tests and search only in /src
      exclude: ['node_modules', 'dist', '.idea', '.git', '.cache', 'tests/**'],
      include: ['src/**/*.{test,spec}.{ts,js}'],
    },
  })
);
