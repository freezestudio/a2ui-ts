import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
  lint: {
    // resources/ 是官方规范副本（specification/v1_0），非本项目代码，不参与 lint
    ignorePatterns: ['resources/**'],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
