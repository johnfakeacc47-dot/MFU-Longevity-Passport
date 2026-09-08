import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      injectManifest: {
        // Precache the app shell only. The TF.js model shards (~40 MB) are cached
        // on first use by a runtime handler in src/sw.ts, not shipped in the
        // install manifest.
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        globIgnores: ['**/model/**', '**/model_backup/**', '**/*.bin', '**/*.keras'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      manifest: {
        name: 'MFU Longevity Passport',
        short_name: 'Passport',
        description: 'MFU Longevity Passport - AI health tracking for anti-aging and longevity.',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    rollupOptions: {
      output: {
        // Per-module form: keep React in its own vendor chunk, but let TF.js
        // fall into the async chunk of its only importer (the lazy
        // FoodRecognition). The previous array form forced a shared CJS-interop
        // helper into the tensorflow chunk and made index.js import it back
        // eagerly, pulling the whole 260 KB chunk into every page load.
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react-vendor';
        },
      },
    },
    chunkSizeWarningLimit: 1000,
  },
  esbuild: mode === 'production' ? { drop: ['console', 'debugger'] } : {},
}));
