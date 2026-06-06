import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    svelte(),
    {
      name: 'history-fallback',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = new URL(req.url, 'http://localhost');
          const path = url.pathname;
          if (
            path.startsWith('/vote/') ||
            path.startsWith('/results/') ||
            path === '/voting' ||
            path === '/voting/'
          ) {
            req.url = '/voting.html';
          }
          next();
        });
      }
    }
  ],
  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        voting: 'voting.html'
      }
    }
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        headers: {
          Authorization: 'Bearer dev-api-key-sample'
        }
      }
    }
  }
})
