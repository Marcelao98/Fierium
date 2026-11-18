import { defineConfig } from '@playwright/test';

// FIERIUM_PORTA_E2E deixa vários executores rodarem o e2e ao mesmo tempo na mesma máquina (cada um na sua porta)
const porta = Number(process.env.FIERIUM_PORTA_E2E ?? 4180);

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: { baseURL: `http://127.0.0.1:${porta}`, viewport: { width: 1280, height: 800 } },
  webServer: {
    command: `pnpm build && pnpm preview --host 127.0.0.1 --port ${porta}`,
    url: `http://127.0.0.1:${porta}`,
    reuseExistingServer: !process.env.CI,
  },
});
