import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import securityPlugin from 'eslint-plugin-security';

export default [
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  {
    files: ['src/**/*.ts', 'test/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'security': securityPlugin,
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...securityPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      'no-restricted-imports': ['error', {
        patterns: [
          {
            regex: '^(?:\\.\\./)+(?:auth|users|tenants|testimonials|webhooks|analytics|api-keys|feature-flags|shared)/(?:[^/]+/)*(?:services|repositories|controllers|dto|entities|utils)/',
            message: 'Importá desde la API pública del módulo, no desde su implementación interna.',
          },
          {
            regex: '^(?:\\.\\./)+shared/(?:[^/]+/)*[^/]+\\.service$',
            message: 'Importá el servicio compartido desde su API pública.',
          },
          {
            regex: '^(?:\\.\\./)+(?:web)(?:/|$)|^@testimonial-cms/web(?:/|$)|^apps/web/',
            message: 'La API no puede importar código del workspace web.',
          },
        ],
      }],
    },
  },
];
