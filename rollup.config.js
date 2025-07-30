import typescript from '@rollup/plugin-typescript';
import replace from '@rollup/plugin-replace';
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
    replace({
      preventAssignment: true,
      __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
    }),
    nodeResolve(),
    typescript({
      tsconfig: './tsconfig.json',
      compilerOptions: {
        removeComments: true,
      },
    }),
  ],
  treeshake: false,
};
