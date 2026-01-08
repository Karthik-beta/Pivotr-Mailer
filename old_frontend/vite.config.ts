import path from 'node:path'
import { defineConfig, loadEnv } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'

const config = defineConfig(({ mode }) => {
  // Load .env from project root (parent directory)
  const envDir = path.resolve(__dirname, '..')
  const env = loadEnv(mode, envDir, '')

  return {
    envDir,
    // Expose APPWRITE_* variables to the frontend as import.meta.env.VITE_APPWRITE_*
    define: {
      'import.meta.env.VITE_APPWRITE_ENDPOINT': JSON.stringify(env.APPWRITE_ENDPOINT),
      'import.meta.env.VITE_APPWRITE_PROJECT_ID': JSON.stringify(env.APPWRITE_PROJECT_ID),
      'import.meta.env.VITE_APPWRITE_PROJECT_NAME': JSON.stringify(env.APPWRITE_PROJECT_NAME),
    },
    plugins: [
      // this is the plugin that enables path aliases
      viteTsConfigPaths({
        projects: ['./tsconfig.json'],
      }),
      tailwindcss(),
      tanstackStart(),
      viteReact(),
    ],
  }
})

export default config
