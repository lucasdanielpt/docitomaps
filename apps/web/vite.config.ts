import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import {
  cesiumConfigDirFromMeta,
  resolveCesiumBuildDir,
  serveCesiumDev,
} from './vite.cesium';

const configDir = cesiumConfigDirFromMeta(import.meta.url);
const cesiumSource = path.join(configDir, 'node_modules/cesium/Build/Cesium');
const cesiumBaseUrl = 'cesiumStatic';

export default defineConfig({
  plugins: [
    react(),
    serveCesiumDev(`/${cesiumBaseUrl}`, resolveCesiumBuildDir(configDir)),
    viteStaticCopy({
      targets: [
        { src: `${cesiumSource}/ThirdParty`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Workers`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Assets`, dest: cesiumBaseUrl },
        { src: `${cesiumSource}/Widgets`, dest: cesiumBaseUrl },
      ],
    }),
  ],
  define: {
    CESIUM_BASE_URL: JSON.stringify(`/${cesiumBaseUrl}`),
  },
  resolve: {
    alias: {
      '@': path.resolve(configDir, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
});
