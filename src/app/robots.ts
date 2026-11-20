import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/dashboard',
          '/admin',
          '/api',
          '/settings',
          '/onboarding',
          '/checkin',
        ],
      },
    ],
    sitemap: 'https://ticvite.com/sitemap.xml',
  }
}
