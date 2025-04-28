import { join } from 'node:path';
import { sentryVitePlugin } from '@sentry/vite-plugin';
import react from '@vitejs/plugin-react';
import type { ConfigEnv, UserConfig } from 'vite';

const srcRoot = join(__dirname, 'src');

export default ({ command }: ConfigEnv): UserConfig => {
  // DEV
  if (command === 'serve') {
    return {
      root: srcRoot,
      base: '/',
      plugins: [react()],
      resolve: {
        alias: {
          '@': srcRoot,
          '@electron': join(__dirname, 'electron'),
          '@shared': join(__dirname, 'shared'),
        },
      },
      build: {
        outDir: join(srcRoot, '/out'),
        emptyOutDir: true,
        rollupOptions: {},
        sourcemap: true,
      },
      server: {
        port: process.env.PORT === undefined ? 3000 : +process.env.PORT,
      },
      optimizeDeps: {
        exclude: ['path'],
      },
      define: {
        'process.env.NODE_ENV': JSON.stringify('development'),
      },
    };
  }
  // PROD
  return {
    root: srcRoot,
    base: './',
    plugins: [react()],
    resolve: {
      alias: {
        '@': srcRoot,
        '@electron': join(__dirname, 'electron'),
        '@shared': join(__dirname, 'shared'),
      },
    },
    build: {
      outDir: join(srcRoot, '/out'),
      emptyOutDir: true,
      rollupOptions: {},
      sourcemap: true,
    },
    server: {
      port: process.env.PORT === undefined ? 3000 : +process.env.PORT,
    },
    optimizeDeps: {
      exclude: ['path'],
    },
    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },
  };
};
