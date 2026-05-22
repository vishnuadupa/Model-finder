export default function robots() {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
    },
    sitemap: 'https://llm-matcher.vercel.app/sitemap.xml',
  }
}
