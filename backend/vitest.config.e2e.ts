import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    setupFiles: ['./test/setup-env.ts'],
    // e2e memakai database sungguhan + bcrypt, jadi jangan diparalelkan.
    fileParallelism: false,
  },
});
