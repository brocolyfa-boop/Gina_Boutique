import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // En desarrollo la web habla con la API por el mismo origen: sin CORS.
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
  build: {
    // Code splitting: las dependencias van a su propio chunk, así al navegar
    // entre páginas solo se descarga el código de la página. El resto del corte
    // lo dan los `lazy()` de las rutas en App.tsx.
    rollupOptions: {
      output: {
        manualChunks: (id: string) => (id.includes('node_modules') ? 'vendor' : undefined),
      },
    },
  },
});
