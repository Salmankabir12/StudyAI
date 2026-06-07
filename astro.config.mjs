import { defineConfig } from 'astro/config'
import cloudflare from '@astrojs/cloudflare'
import react from '@astrojs/react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  output: 'server',
  adapter: cloudflare({ session: false }),
  vite: {
    plugins: [tailwindcss()],
    ssr: { noExternal: ['cookie'] }
  },
  integrations: [react()]
})
