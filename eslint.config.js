// Regras de camada (docs/ARQUITETURA.md §3): as dependências só descem.
//   apps/app (telas) -> estado (stores) -> @fierium/cliente -> @fierium/contratos
//   @fierium/ui não conhece dados; @fierium/contratos não conhece nada.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

const proibir = (...grupos) => ({
  'no-restricted-imports': ['error', { patterns: grupos.map(([group, message]) => ({ group, message })) }],
});

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', 'target/**', '**/test-results/**'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: false }],
      // com noUncheckedIndexedAccess, `lista[i]!` depois de conferir o tamanho é o jeito claro de dizer "existe"
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: { 'react-hooks/rules-of-hooks': 'error', 'react-hooks/exhaustive-deps': 'error' },
  },
  {
    files: ['packages/contratos/**'],
    rules: proibir([['@fierium/*', 'react', 'react-dom', 'zustand'], 'contratos só tem tipos: não importa nada']),
  },
  {
    files: ['packages/diagnostico/**'],
    rules: proibir([['@fierium/*', 'react', 'react-dom', 'zustand'], 'o diagnóstico não depende de nada do app']),
  },
  {
    files: ['packages/cliente/**'],
    rules: proibir([
      ['@fierium/ui', '@fierium/leitores', '@fierium/app', 'react', 'react-dom', 'zustand'],
      'o cliente não conhece a interface',
    ]),
  },
  {
    files: ['packages/leitores/**'],
    rules: proibir([
      ['@fierium/cliente', '@fierium/ui', '@fierium/app', 'react', 'react-dom', 'zustand'],
      'motor de leitura só conhece o contrato e o DOM',
    ]),
  },
  {
    files: ['packages/ui/**'],
    rules: proibir([
      ['@fierium/cliente', '@fierium/leitores', '@fierium/app', 'zustand'],
      'a ui (design system) não conhece dados nem estado',
    ]),
  },
  {
    // uma funcionalidade nunca importa outra (conversam por eventos: nucleo/eventos.ts)
    files: ['apps/app/src/recursos/**'],
    // nos testes pode usar o cliente em memória e os dados de exemplo (o resto da regra vale igual)
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '^\\.\\./(?!\\.\\./)',
              message:
                'uma funcionalidade não importa outra: use um evento (nucleo/eventos) ou mova pra compartilhado/',
            },
            {
              regex: '^\\.\\./\\.\\./recursos/',
              message: 'uma funcionalidade não importa outra: use um evento (nucleo/eventos)',
            },
            {
              group: ['@fierium/cliente', '@fierium/cliente/*'],
              message: 'funcionalidade fala com o núcleo pelos Servicos (nucleo/servicos), não pelo cliente',
            },
            {
              group: ['**/plataforma', '**/plataforma/*'],
              message: 'funcionalidade não escolhe o adaptador: isso é do main.tsx',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/app/src/recursos/**/*.test.ts', 'apps/app/src/recursos/**/*.test.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { regex: '^\\.\\./(?!\\.\\./)', message: 'teste de uma funcionalidade não importa outra' },
            { regex: '^\\.\\./\\.\\./recursos/', message: 'teste de uma funcionalidade não importa outra' },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/app/src/casca/**', 'apps/app/src/compartilhado/**', 'apps/app/src/nucleo/**'],
    rules: proibir(
      [['**/recursos/**'], 'casca, compartilhado e núcleo não conhecem as funcionalidades (só App.tsx e montar.ts)'],
      [['**/plataforma', '**/plataforma/*'], 'só o main.tsx escolhe o adaptador'],
    ),
  },
);
