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
  {
    files: ['src/modules/**/entities/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "ImportDeclaration[source.value=/^@nestjs\\//]",
          message: 'El dominio no puede depender de NestJS.',
        },
        {
          selector: "ImportDeclaration[source.value=/^@prisma\\//]",
          message: 'El dominio no puede depender de Prisma.',
        },
        {
          selector: "ImportDeclaration[source.value=/\\/(?:repositories|services|controllers|dto)\\//]",
          message: 'El dominio no puede importar capas externas.',
        },
      ],
    },
  },
  {
    files: ['src/modules/**/{services,repositories,use-cases,utils}/**/*.ts', 'src/common/services/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "ImportDeclaration[source.value='@nestjs/common'] ImportSpecifier[imported.name=/Exception$/]",
          message: 'Usá errores internos y dejá la traducción HTTP al filtro global.',
        },
        {
          selector: "ImportDeclaration[source.value='@nestjs/common'] ImportSpecifier[imported.name='HttpStatus']",
          message: 'Los estados HTTP pertenecen a la capa de transporte.',
        },
      ],
    },
  },
  {
    files: ['src/modules/**/{services,use-cases}/**/*.ts', 'src/common/services/**/*.ts'],
    ignores: ['src/modules/health/**'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "ImportDeclaration[source.value='@nestjs/common'] ImportSpecifier[imported.name=/Exception$/]",
          message: 'Usá errores internos y dejá la traducción HTTP al filtro global.',
        },
        {
          selector: "ImportDeclaration[source.value='@nestjs/common'] ImportSpecifier[imported.name='HttpStatus']",
          message: 'Los estados HTTP pertenecen a la capa de transporte.',
        },
        {
          selector: "ImportDeclaration[source.value=/^@prisma\\//]",
          message: 'La aplicación debe acceder a datos mediante repositorios.',
        },
        {
          selector: "ImportDeclaration[source.value=/\\/database\\/prisma.service$/]",
          message: 'La aplicación debe acceder a Prisma mediante repositorios.',
        },
      ],
    },
  },
  {
    files: ['src/common/guards/**/*.ts'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "ImportDeclaration[source.value=/^@prisma\\//]",
          message: 'La capa de transporte y aplicación debe acceder a datos mediante repositorios.',
        },
        {
          selector: "ImportDeclaration[source.value=/\\/database\\/prisma.service$/]",
          message: 'La capa de transporte y aplicación debe acceder a Prisma mediante repositorios.',
        },
      ],
    },
  },
];
