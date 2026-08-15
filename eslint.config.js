import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsparser from '@typescript-eslint/parser'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import prettier from 'eslint-config-prettier'

export default [
  { ignores: ['dist', 'node_modules', 'server', '**/*.d.ts', 'src/mock/**'] },
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module', ecmaFeatures: { jsx: true } },
      globals: { window: 'readonly', document: 'readonly', navigator: 'readonly', console: 'readonly', setTimeout: 'readonly', setInterval: 'readonly', clearTimeout: 'readonly', clearInterval: 'readonly', fetch: 'readonly', URL: 'readonly', Blob: 'readonly', FileReader: 'readonly', localStorage: 'readonly', location: 'readonly', history: 'readonly', HTMLElement: 'readonly', HTMLInputElement: 'readonly', HTMLDivElement: 'readonly', HTMLCanvasElement: 'readonly', requestAnimationFrame: 'readonly', cancelAnimationFrame: 'readonly', ResizeObserver: 'readonly', MutationObserver: 'readonly', performance: 'readonly', matchMedia: 'readonly', Worker: 'readonly', Event: 'readonly', CustomEvent: 'readonly', WebSocket: 'readonly', FormData: 'readonly', AbortController: 'readonly' }
    },
    plugins: { '@typescript-eslint': tseslint, 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'off',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-empty': ['warn', { allowEmptyCatch: true }]
    }
  },
  prettier
]
