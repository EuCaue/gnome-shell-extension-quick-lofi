import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: ['src/extension.ts', 'src/prefs.ts'],
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: false,
    indent: true, // identação bonitinha
    compact: false, // não junta tudo em uma linha só
    minifyInternalExports: false, // mantém nomes dos exports
    preserveModules: true, // separa arquivos
    preserveModulesRoot: 'src', // mantém estrutura da pasta src
  },
  plugins: [
    nodeResolve(),
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        removeComments: false, // mantém os comentários no output
      },
    }),
  ],
  treeshake: false, // evita remover código não usado
};
