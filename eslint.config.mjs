import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
  js.configs.recommended,
  tseslint.configs.recommended,
  stylistic.configs.recommended,
  { files: ['bin/**'], languageOptions: { globals: { process: 'readonly', console: 'readonly' } } },
  { rules: { '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }] } },
)
