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
    rules: { 'no-empty': ['error', { allowEmptyCatch: false }] },
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
    files: ['packages/cliente/**'],
    rules: proibir(
      [['@fierium/ui', '@fierium/app', 'react', 'react-dom', 'zustand'], 'o cliente não conhece a interface'],
    ),
  },
  {
    files: ['packages/ui/**'],
    rules: proibir(
      [['@fierium/cliente', '@fierium/app', 'zustand'], 'a ui (design system) não conhece dados nem estado'],
    ),
  },
  {
    files: ['apps/app/src/telas/**', 'apps/app/src/componentes/**'],
    rules: proibir(
      [['**/plataforma', '**/plataforma/*'], 'telas não falam com o backend: use uma store (src/estado)'],
      [['@fierium/cliente/*'], 'telas usam o estado, não os adaptadores'],
    ),
  },
);
