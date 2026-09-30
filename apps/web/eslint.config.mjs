import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{
          regex: '^(?:\\.\\./)+(?:apps/)?api/(?:src|prisma)(?:/|$)|^@testimonial-cms/api(?:/|$)|^apps/api/',
          message: 'Web no puede importar código del workspace API.',
        }],
      }],
    },
  },
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/features/**/{screens,components}/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error',
        {
          selector: "CallExpression[callee.name='fetch']",
          message: 'Las rutas y pantallas deben acceder a NestJS mediante un adaptador de feature.',
        },
        {
          selector: "ImportDeclaration[source.value='@/lib/api'] ImportSpecifier[imported.name='requestApi']",
          message: 'Importá el adaptador de la feature en lugar del cliente HTTP directamente.',
        },
      ],
    },
  },
];

export default config;
