import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(), 
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        maximumFileSizeToCacheInBytes: 15 * 1024 * 1024 // 15 MB limit (increased from 2 MB)
      },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'gt-favicon.svg'],
      manifest: {
        name: 'GradTrack Alumni Tracker',
        short_name: 'GradTrack',
        description: 'Alumni Career Path Tracker: Data-Driven Insights for Curriculum Improvement',
        theme_color: '#800000', 
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
            purpose: 'any'
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: {
          // Split React into its own chunk
          'react-vendor': ['react', 'react-dom'],
          // Split Supabase into its own chunk
          'supabase-vendor': ['@supabase/supabase-js'],
          // Split charts into its own chunk
          'charts-vendor': ['recharts'],
          // Split PDF generation into its own chunk
          'pdf-vendor': ['jspdf', 'jspdf-autotable'],
          // Split Excel generation into its own chunk
          'excel-vendor': ['xlsx'],
          // Split PWA plugin
          'pwa-vendor': ['vite-plugin-pwa']
        }
      }
    }
  }
});