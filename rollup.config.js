import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from '@rollup/plugin-json';

export default {
  input: 'src/main.js',
  output: {
    format: 'cjs',
    file: 'dist/main.cjs'
  },
  plugins: [nodeResolve({ preferBuiltins: true }), commonjs(), json()]
};
