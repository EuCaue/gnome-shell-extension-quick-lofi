import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';

export default {
  input: ['src/extension.ts', 'src/prefs.ts'],
  output: {
    dir: 'dist',
    format: 'esm',
    sourcemap: false,
    indent: true,
    compact: false,
    minifyInternalExports: false,
    preserveModules: true,
    preserveModulesRoot: 'src',
  },
  plugins: [
    nodeResolve(),
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        removeComments: false,
      },
    }),
  ],
  treeshake: false,
};
