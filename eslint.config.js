import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

// ----- 共享：TS 基础规则 -----
const tsBase = {
  plugins: { '@typescript-eslint': tseslint },
  languageOptions: {
    parser: tsparser,
    parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
  },
  rules: {
    'no-unused-vars': 'off',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    '@typescript-eslint/no-explicit-any': 'off',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-undef': 'off', // TS 编译器负责
  },
}

// ----- 前端 src/**/*.{ts,tsx}：DOM globals + React 规则 -----
const frontendTs = {
  files: ['src/**/*.{ts,tsx}'],
  languageOptions: {
    ...tsBase.languageOptions,
    parserOptions: { ...tsBase.languageOptions.parserOptions, ecmaFeatures: { jsx: true } },
    globals: {
      window: 'readonly', document: 'readonly', navigator: 'readonly',
      console: 'readonly', setTimeout: 'readonly', setInterval: 'readonly',
      clearTimeout: 'readonly', clearInterval: 'readonly', fetch: 'readonly',
      URL: 'readonly', URLSearchParams: 'readonly', Blob: 'readonly', File: 'readonly',
      FileList: 'readonly', FileReader: 'readonly', localStorage: 'readonly',
      sessionStorage: 'readonly', location: 'readonly', history: 'readonly',
      HTMLElement: 'readonly', HTMLInputElement: 'readonly', HTMLDivElement: 'readonly',
      HTMLCanvasElement: 'readonly', requestAnimationFrame: 'readonly',
      cancelAnimationFrame: 'readonly', ResizeObserver: 'readonly',
      MutationObserver: 'readonly', IntersectionObserver: 'readonly',
      performance: 'readonly', matchMedia: 'readonly', Worker: 'readonly',
      Event: 'readonly', CustomEvent: 'readonly', WebSocket: 'readonly',
      FormData: 'readonly', AbortController: 'readonly', Headers: 'readonly',
      Request: 'readonly', Response: 'readonly',
    },
  },
  plugins: { ...tsBase.plugins, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
  rules: {
    ...tsBase.rules,
    ...reactHooks.configs.recommended.rules,
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
}

// ----- 后端 server/src/**/*.ts：Node globals，无 React -----
const backendTs = {
  files: ['server/src/**/*.ts'],
  languageOptions: {
    ...tsBase.languageOptions,
    globals: {
      // Node.js 全局
      process: 'readonly', __dirname: 'readonly', __filename: 'readonly',
      require: 'readonly', module: 'readonly', exports: 'writable',
      global: 'readonly', Buffer: 'readonly', URL: 'readonly', URLSearchParams: 'readonly',
      TextEncoder: 'readonly', TextDecoder: 'readonly',
      setTimeout: 'readonly', setInterval: 'readonly', clearTimeout: 'readonly',
      clearInterval: 'readonly', setImmediate: 'readonly', clearImmediate: 'readonly',
      console: 'readonly',
      // ESM
      import: 'readonly',
    },
  },
  plugins: tsBase.plugins,
  rules: {
    ...tsBase.rules,
    'no-console': 'off', // 后端 logger 之外偶尔需要 console
    '@typescript-eslint/no-require-imports': 'off',
  },
}

export default [
  { ignores: ['dist', 'node_modules', '**/*.d.ts', 'src/mock/**', 'server/dist/**', 'server/backups/**', 'server/data/**', 'server/uploads/**'] },
  js.configs.recommended,
  frontendTs,
  backendTs,
  prettier,
]
