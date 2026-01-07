import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiUrl = env.VITE_API_URL || 'http://localhost:4001';

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      port: 5171,
      strictPort: false,
      watch: {
        ignored: ['**/node_modules/**', '**/.git/**'],
      },
      hmr: {
        overlay: false,
      },
      allowedHosts: [
        'musicmu.local',
        '.local',  // allow any *.local hostname
        'localhost',
      ],
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true,
        },
      },
    },
  };
});
