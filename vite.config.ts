import { fileURLToPath, URL } from 'node:url'

import type { Plugin } from 'vite'
import { defineConfig } from 'vite'
import pkg from './package.json'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'
import { VitePWA } from 'vite-plugin-pwa'

function resolveAppBuildId(isDevelopment: boolean): string {
  if (isDevelopment) return 'dev'
  return (
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.CI_COMMIT_SHA ??
    process.env.VITE_BUILD_ID ??
    `build-${Date.now()}`
  )
}

function buildMetaPlugin(opts: { version: string; buildId: string }): Plugin {
  const payload = JSON.stringify({ version: opts.version, buildId: opts.buildId })
  return {
    name: 'build-meta',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathOnly = req.url?.split('?')[0]
        if (pathOnly !== '/build-meta.json') {
          next()
          return
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'no-store')
        res.end(payload)
      })
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'build-meta.json',
        source: payload,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const isDevelopment = mode === 'development'
  const appBuildId = resolveAppBuildId(isDevelopment)

  return {
    define: {
      __APP_VERSION__: JSON.stringify(pkg.version),
      __APP_BUILD_ID__: JSON.stringify(appBuildId),
    },
    plugins: [
      buildMetaPlugin({ version: pkg.version, buildId: appBuildId }),
      vue(),
      vueDevTools(),
      VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module',
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
      manifest: {
        name: 'Jobs Dashboard',
        short_name: 'Jobs Dashboard',
        description: 'Manage manufacturing jobs',
        theme_color: '#1a1a2e',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
  }
})
