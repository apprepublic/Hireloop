/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [],
  },
}

// Cloudflare Pages compatibility — used when building via @cloudflare/next-on-pages
if (process.env.NEXT_ON_PAGES === 'true') {
  const { setupDevPlatform } = require('@cloudflare/next-on-pages/next-dev')
  setupDevPlatform().catch(console.error)
}

module.exports = nextConfig
