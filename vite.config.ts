import { defineConfig } from 'vite';
import dns from 'node:dns';

// Esto evita problemas de reordenamiento de DNS
dns.setDefaultResultOrder('verbatim');

export default defineConfig({
  server: {
    host: true, // Escuchar en todas las direcciones de red
    hmr: {
      // Configuración para Hot Module Replacement
      timeout: 120000, // Aumentar timeout
    },
  },
});