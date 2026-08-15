import { defineConfig } from 'vite-plus';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
    // AJV 全量 schema 一致性对比在慢速 CI runner 上可能超过默认 5s 超时
    testTimeout: 30_000,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
});
