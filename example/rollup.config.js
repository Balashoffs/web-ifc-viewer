import {nodeResolve} from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import json from "@rollup/plugin-json";

export default {
  input: 'main.js',
  output: {
    file: "build/main.js",
    format: 'iife',
    inlineDynamicImports: true, //Necessary for jspdf
  },
  plugins: [ nodeResolve(), commonjs(),json() ]
};
