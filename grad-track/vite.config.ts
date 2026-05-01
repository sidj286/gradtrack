import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(), 
    VitePWA({
      registerType: 'autoUpdate',
      // Disable devOptions for the production build to avoid internal path errors
      devOptions: {
        enabled: false 
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
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
  ]
});