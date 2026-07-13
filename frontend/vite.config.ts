import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Vite собирает статику в app/static/dist. Flask раздаёт её через /static/dist/.
// manifest.json будет прочитан Flask на старте для получения хэшированных имён.
export default defineConfig({
  plugins: [svelte()],
  base: '/static/dist/',
  resolve: {
    alias: {
      $stores: resolve(__dirname, 'src/stores'),
      $components: resolve(__dirname, 'src/components'),
      $utils: resolve(__dirname, 'src/utils'),
      $types: resolve(__dirname, 'src/types')
    }
  },
  build: {
    outDir: resolve(__dirname, '../app/static/dist'),
    emptyOutDir: true,
    manifest: true,
    target: 'esnext',
    cssCodeSplit: false,
    rollupOptions: {
      input: resolve(__dirname, 'src/main.ts'),
      output: {
        entryFileNames: 'assets/app.[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name || '';
          if (name.endsWith('.css')) return 'assets/app.[hash].css';
          return 'assets/[name].[hash][extname]';
        }
      }
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:9090',
        changeOrigin: true,
        // SSE требует отключения буферизации:
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            if (proxyRes.headers['content-type']?.includes('text/event-stream')) {
              // Заставим ноду не буферизировать
              proxyRes.headers['x-accel-buffering'] = 'no';
            }
          });
        }
      },
      '/static': 'http://localhost:9090',
      '/healthz': 'http://localhost:9090'
    }
  }
});
