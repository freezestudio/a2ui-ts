import { defineConfig } from 'vite-plus';

export default defineConfig({
  fmt: {
    ignorePatterns: [
      // A2UI 官方规范副本（只读），非本项目代码，不参与格式化
      'packages/sdk/resources/specification/**',
    ],
    singleQuote: true,
    semi: true,
    tabWidth: 2,
    useTabs: false,
    printWidth: 120,
    trailingComma: 'all',
  },
  lint: {
    ignorePatterns: [
      // A2UI 官方规范副本（只读），非本项目代码，不参与 lint
      'packages/sdk/resources/specification/**',
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  check: {
    fmt: true,
    lint: true,
  },
});
