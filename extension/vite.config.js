import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import fs from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'copy-manifest-and-icons',
      closeBundle: () => {
        // Copy manifest.json to dist
        fs.copyFileSync(
          resolve(__dirname, 'manifest.json'),
          resolve(__dirname, 'dist/manifest.json')
        );
        
        // Ensure icons directory exists in dist
        const distIconsDir = resolve(__dirname, 'dist/icons');
        if (!fs.existsSync(distIconsDir)) {
          fs.mkdirSync(distIconsDir, { recursive: true });
        }
        
        // Copy icons from public to dist
        ['16', '48', '128'].forEach(size => {
          fs.copyFileSync(
            resolve(__dirname, `public/icons/Icon${size}.png`),
            resolve(__dirname, `dist/icons/Icon${size}.png`)
          );
        });
      }
    }
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
        background: resolve(__dirname, 'src/background.js'),
        contentScript: resolve(__dirname, 'src/contentScript.js')
      },
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]'
      }
    },
    copyPublicDir: true
  },
  publicDir: 'public'
}); 