import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/node_modules/**',
      '**/.expo/**',
      '**/generated/**',
      'apps/api/prisma/migrations/**',
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      // Los "!" tras requiereAuth son intencionales: el middleware ya garantizó req.usuario.
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
