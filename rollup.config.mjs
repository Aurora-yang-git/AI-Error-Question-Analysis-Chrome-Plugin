import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import copy from 'rollup-plugin-copy';

export default [
  {
    input: 'sidepanel/index.js',
    output: {
      dir: 'dist/sidepanel',
      format: 'iife',
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
            src: ['manifest.json', 'background.js', 'images'],
            dest: 'dist'
          },
          {
            src: ['sidepanel/index.html', 'sidepanel/index.css'],
            dest: 'dist/sidepanel'
          },
          {
            src: ['content/analyzer-ui.css'],
            dest: 'dist/content'
          },
          {
            src: ['node_modules/katex/dist/katex.min.css'],
            dest: 'dist/node_modules/katex/dist'
          },
          {
            src: ['offscreen/offscreen.html'],
            dest: 'dist/offscreen'
          }
        ]
      })
    ]
  },
  {
    input: 'scripts/extract-content.js',
    output: {
      dir: 'dist/scripts',
      format: 'es'
    },
    plugins: [
      commonjs(),
      nodeResolve()
    ]
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
  }
];
