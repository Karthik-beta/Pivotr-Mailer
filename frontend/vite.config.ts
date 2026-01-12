import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  plugins: [
    devtools(),
    nitro(),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
  ],
  server: {
    port: 3000,
    proxy: {
      // Proxy /api requests to SAM local API running on port 3001
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Rewrite /api/* to /* to match SAM local API (no stage name)
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})

export default config
