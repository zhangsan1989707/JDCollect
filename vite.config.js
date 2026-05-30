import { defineConfig, build as viteBuild } from 'vite';
import { resolve } from 'path';
import { copyFileSync, cpSync } from 'fs';

const root = resolve(__dirname);
const src = resolve(root, 'src');
const dist = resolve(root, 'dist');

export default defineConfig({
  root: src,
  base: '/',
  build: {
    outDir: dist,
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    modulePreload: false,
    rollupOptions: {
      input: {
        popup: resolve(src, 'popup/popup.html'),
        dashboard: resolve(src, 'dashboard/dashboard.html'),
      },
      output: {
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash][extname]',
      },
    },
  },
  plugins: [
    {
      name: 'chrome-extension-build',
      async closeBundle() {
        await viteBuild({
          configFile: false,
          build: {
            outDir: resolve(dist, 'background'),
            emptyOutDir: false,
            minify: false,
            sourcemap: false,
            lib: {
              entry: resolve(src, 'background/background.js'),
              name: 'background',
              formats: ['iife'],
              fileName: () => 'background.js',
            },
            rollupOptions: {
              output: {
                extend: true,
              },
            },
          },
        });

        await viteBuild({
          configFile: false,
          build: {
            outDir: resolve(dist, 'content'),
            emptyOutDir: false,
            minify: false,
            sourcemap: false,
            lib: {
              entry: resolve(src, 'content/content.js'),
              name: 'content',
              formats: ['iife'],
              fileName: () => 'content.js',
            },
            rollupOptions: {
              output: {
                extend: true,
              },
            },
          },
        });

        copyFileSync(
          resolve(root, 'manifest.json'),
          resolve(dist, 'manifest.json')
        );

        cpSync(resolve(src, 'assets'), resolve(dist, 'assets'), {
          recursive: true,
        });
      },
    },
  ],
});
