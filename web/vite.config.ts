import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      injectRegister: false,
      manifest: {
        name: 'Axiom Pulse',
        short_name: 'Pulse',
        description: 'The pulse of every delivery.',
        theme_color: '#ffffff',
        background_color: '#eef4fc',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      injectManifest: {
        injectionPoint: undefined,
        // Safari has never supported `type: 'module'` service workers —
        // build the worker as a classic (IIFE) script so it registers on
        // iOS/iPadOS at all, not just Chromium-based browsers.
        rollupFormat: 'iife',
      },
      devOptions: { enabled: true, type: 'classic' },
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
});
