import { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getShortId(id: string): string {
  return id.replace(/-/g, '').substring(0, 7)
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://ticvite.com'

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
    { url: `${baseUrl}/explore`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${baseUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${baseUrl}/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/refund-policy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${baseUrl}/help`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${baseUrl}/login`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
    { url: `${baseUrl}/register`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.4 },
  ]

  // Dynamic: published events
  let eventPages: MetadataRoute.Sitemap = []
  try {
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
    const { data: events } = await supabase
      .from('events')
      .select('id, submitted_at')
      .eq('status', 'published')
      .is('deleted_at', null)
      .order('date', { ascending: false })
      .limit(5000)

    if (events) {
      eventPages = events.map((event) => ({
        url: `${baseUrl}/e/${getShortId(event.id)}`,
        lastModified: event.submitted_at ? new Date(event.submitted_at) : new Date(),
        changeFrequency: 'weekly' as const,
        priority: 0.7,
      }))
    }
  } catch {
    // Sitemap should not fail — return static pages only
  }

  return [...staticPages, ...eventPages]
}
