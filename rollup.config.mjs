import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

export default [
  {
    // Static assets copy & global resources
    input: 'scripts/extract-content.js', // dummy, real scripts defined below; keep plugins for copy
    output: { dir: 'dist/scripts', format: 'es' },
    plugins: [
      commonjs(),
      nodeResolve(),
      copy({
        targets: [
          { src: ['manifest.json', 'images', 'supabase-config.js'], dest: 'dist' },
          { src: ['utils/supabase-service.js'], dest: 'dist/utils' },
          { src: ['content/analyzer-ui.css'], dest: 'dist/content' },
          { src: ['node_modules/katex/dist/katex.min.css'], dest: 'dist/node_modules/katex/dist' },
          { src: ['offscreen/offscreen.html'], dest: 'dist/offscreen' },
          { src: ['popup/popup.html', 'popup/popup.css'], dest: 'dist/popup' },
          { src: ['misconceptions/misconceptions.html', 'misconceptions/misconceptions.css'], dest: 'dist/misconceptions' },
          { src: ['style/base.css'], dest: 'dist/style' }
        ]
      })
    ]
  },
  {
    input: 'scripts/extract-content.js',
    output: { dir: 'dist/scripts', format: 'es' },
    plugins: [ commonjs(), nodeResolve() ]
  },
  {
    input: 'content/analyzer-ui.js',
    output: {
      dir: 'dist/content',
      format: 'iife'
    },
    plugins: [
      nodeResolve({
        jsnext: true,
        main: true,
        browser: true
      }),
      commonjs(),
      copy({
        targets: [
          {
            src: ['utils/markdown-renderer.js'],
            dest: 'dist/utils'
          }
        ]
      })
    ]
  },
  {
    input: 'offscreen/offscreen.js',
    output: {
      dir: 'dist/offscreen',
      format: 'iife'
    },
    plugins: [
      nodeResolve({
        jsnext: true,
        main: true,
        browser: true
      }),
      commonjs()
    ]
  },
  {
    input: 'background.js',
    output: {
      file: 'dist/background.js',
      format: 'iife'
    },
    plugins: [
      nodeResolve({
        jsnext: true,
        main: true,
        browser: true
      }),
      commonjs()
    ]
  },
  {
    input: 'popup/popup.js',
    output: {
      dir: 'dist/popup',
      format: 'iife'
    },
    plugins: [
      nodeResolve({
        jsnext: true,
        main: true,
        browser: true
      }),
      commonjs()
    ]
  },
  {
    input: 'misconceptions/misconceptions.js',
    output: {
      dir: 'dist/misconceptions',
      format: 'iife'
    },
    plugins: [
      nodeResolve({
        jsnext: true,
        main: true,
        browser: true
      }),
      commonjs()
    ]
  }
];
