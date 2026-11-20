/**
 * Daily cleanup cron job.
 *
 * 1. Purge events whose date is > 5 days in the past (and their poster images)
 * 2. Delete orphaned poster images not referenced by any event
 *
 * Schedule: defined in vercel.json
 * Auth:     Authorization: Bearer ${CRON_SECRET}
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  const expected = `Bearer ${process.env.CRON_SECRET || ''}`
  if (!process.env.CRON_SECRET || authHeader !== expected) return unauthorized()

  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE_KEY) {
    return NextResponse.json({ error: 'Missing env vars' }, { status: 500 })
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false },
  })

  const logs: string[] = []
  const log = (msg: string) => { logs.push(msg); console.log(`[cleanup] ${msg}`) }

  try {
    // ─── 0. Hard-delete soft-deleted events older than 72 hours ───
    const hardDeleteCutoff = new Date()
    hardDeleteCutoff.setHours(hardDeleteCutoff.getHours() - 72)
    const hardDeleteCutoffStr = hardDeleteCutoff.toISOString()

    const { data: staleDeleted, error: staleErr } = await supabase
      .from('events')
      .select('id, image_url')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', hardDeleteCutoffStr)

    if (staleErr) {
      log(`Error fetching stale soft-deleted events: ${staleErr.message}`)
    } else if (staleDeleted && staleDeleted.length > 0) {
      log(`Found ${staleDeleted.length} soft-deleted events older than 72h — hard deleting`)

      const bucketBase = `${SUPABASE_URL}/storage/v1/object/public/event-posters/`
      const posterPaths: string[] = []
      for (const evt of staleDeleted) {
        if (evt.image_url && evt.image_url.startsWith(bucketBase)) {
          posterPaths.push(evt.image_url.replace(bucketBase, ''))
        }
      }

      // Delete poster images
      if (posterPaths.length > 0) {
        for (let i = 0; i < posterPaths.length; i += 100) {
          await supabase.storage.from('event-posters').remove(posterPaths.slice(i, i + 100))
        }
        log(`Deleted ${posterPaths.length} poster images from hard-deleted events`)
      }

      // Hard delete the event rows
      const ids = staleDeleted.map(e => e.id)
      for (let i = 0; i < ids.length; i += 500) {
        const batch = ids.slice(i, i + 500)
        await supabase.from('event_tiers').delete().in('event_id', batch)
        await supabase.from('event_rsvps').delete().in('event_id', batch)
        await supabase.from('events').delete().in('id', batch)
      }
      log(`Hard-deleted ${ids.length} events`)
    } else {
      log('No soft-deleted events older than 72h')
    }

    // ─── 1. Purge expired events (date > 5 days ago) ───
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 5)
    const cutoffStr = cutoff.toISOString().split('T')[0]

    // Fetch expired events to get their poster URLs before deleting
    const { data: expiredEvents, error: fetchErr } = await supabase
      .from('events')
      .select('id, image_url')
      .lt('date', cutoffStr)

    if (fetchErr) {
      log(`Error fetching expired events: ${fetchErr.message}`)
    } else if (expiredEvents && expiredEvents.length > 0) {
      log(`Found ${expiredEvents.length} expired events (before ${cutoffStr})`)

      // Collect poster file paths to delete from storage
      const bucketBase = `${SUPABASE_URL}/storage/v1/object/public/event-posters/`
      const posterPaths: string[] = []
      for (const evt of expiredEvents) {
        if (evt.image_url && evt.image_url.startsWith(bucketBase)) {
          posterPaths.push(evt.image_url.replace(bucketBase, ''))
        }
      }

      // Delete the event rows (cascade will handle related tables like RSVPs, tiers)
      const expiredIds = expiredEvents.map(e => e.id)
      // Delete in batches of 500
      let deletedEvents = 0
      for (let i = 0; i < expiredIds.length; i += 500) {
        const batch = expiredIds.slice(i, i + 500)
        // Delete related tiers first
        await supabase.from('event_tiers').delete().in('event_id', batch)
        // Delete related RSVPs
        await supabase.from('event_rsvps').delete().in('event_id', batch)
        // Delete events
        const { error: delErr, count } = await supabase
          .from('events')
          .delete({ count: 'exact' })
          .in('id', batch)
        if (delErr) {
          log(`Error deleting event batch: ${delErr.message}`)
        } else {
          deletedEvents += count || 0
        }
      }
      log(`Deleted ${deletedEvents} expired events`)

      // Delete their poster images from storage
      if (posterPaths.length > 0) {
        let deletedPosters = 0
        for (let i = 0; i < posterPaths.length; i += 100) {
          const batch = posterPaths.slice(i, i + 100)
          const { error: storErr } = await supabase.storage
            .from('event-posters')
            .remove(batch)
          if (storErr) {
            log(`Error deleting poster batch: ${storErr.message}`)
          } else {
            deletedPosters += batch.length
          }
        }
        log(`Deleted ${deletedPosters} poster images from expired events`)
      }
    } else {
      log('No expired events to purge')
    }

    // ─── 2. Delete orphaned poster images ───
    // Get all image_urls currently used by events
    const usedUrls = new Set<string>()
    let from = 0
    while (true) {
      const { data } = await supabase
        .from('events')
        .select('image_url')
        .not('image_url', 'is', null)
        .neq('image_url', '')
        .range(from, from + 999)
      if (!data || data.length === 0) break
      data.forEach(e => usedUrls.add(e.image_url))
      from += data.length
      if (data.length < 1000) break
    }
    log(`${usedUrls.size} image URLs in use by events`)

    // List all files in storage and find orphans
    const { data: urlData } = supabase.storage.from('event-posters').getPublicUrl('__dummy__')
    const base = urlData.publicUrl.replace('__dummy__', '')

    const folders = ['crawler', 'guest', 'e1b43bb1-3bbc-4a4b-8fe2-10827c7abf17']
    const orphanPaths: string[] = []
    let orphanSize = 0

    for (const folder of folders) {
      let offset = 0
      while (true) {
        const { data: files, error: listErr } = await supabase.storage
          .from('event-posters')
          .list(folder, { limit: 1000, offset })
        if (listErr || !files || files.length === 0) break
        for (const f of files) {
          if (!f.metadata) continue
          const path = `${folder}/${f.name}`
          const url = base + path
          if (!usedUrls.has(url)) {
            orphanPaths.push(path)
            orphanSize += f.metadata.size || 0
          }
        }
        offset += files.length
        if (files.length < 1000) break
      }
    }

    if (orphanPaths.length > 0) {
      let deletedOrphans = 0
      for (let i = 0; i < orphanPaths.length; i += 100) {
        const batch = orphanPaths.slice(i, i + 100)
        const { error: delErr } = await supabase.storage
          .from('event-posters')
          .remove(batch)
        if (delErr) {
          log(`Error deleting orphan batch: ${delErr.message}`)
        } else {
          deletedOrphans += batch.length
        }
      }
      log(`Deleted ${deletedOrphans} orphaned poster images (${(orphanSize / 1024 / 1024).toFixed(1)} MB)`)
    } else {
      log('No orphaned poster images found')
    }

    // ─── 3. Auto-fix metro_region mismatches ───
    // State → expected default metro (for single-metro states)
    const STATE_DEFAULT_METRO: Record<string, string> = {
      'Massachusetts': 'Boston', 'MA': 'Boston',
      'Illinois': 'Chicago', 'IL': 'Chicago',
      'Colorado': 'Denver', 'CO': 'Denver',
      'Michigan': 'Detroit', 'MI': 'Detroit',
      'Tennessee': 'Nashville', 'TN': 'Nashville',
      'Oregon': 'Portland', 'OR': 'Portland',
      'Ohio': 'Columbus', 'OH': 'Columbus',
      'Utah': 'Salt Lake City', 'UT': 'Salt Lake City',
      'Indiana': 'Indianapolis', 'IN': 'Indianapolis',
      'Wisconsin': 'Milwaukee', 'WI': 'Milwaukee',
      'Missouri': 'St Louis', 'MO': 'St Louis',
    }
    // Multi-metro states: city → correct metro
    const CITY_METRO_FIX: Record<string, string> = {
      // California
      'los angeles': 'LA', 'pasadena': 'LA', 'long beach': 'LA', 'anaheim': 'LA', 'irvine': 'LA',
      'burbank': 'LA', 'glendale': 'LA', 'torrance': 'LA', 'cerritos': 'LA', 'artesia': 'LA',
      'canoga park': 'LA', 'costa mesa': 'LA', 'redondo beach': 'LA', 'arcadia': 'LA', 'hollywood': 'LA',
      'san diego': 'San Diego', 'escondido': 'San Diego', 'chula vista': 'San Diego',
      'sacramento': 'Sacramento', 'elk grove': 'Sacramento', 'rancho cordova': 'Sacramento', 'roseville': 'Sacramento',
      // Texas
      'houston': 'Houston', 'stafford': 'Houston', 'the woodlands': 'Houston', 'sugar land': 'Houston', 'katy': 'Houston',
      'austin': 'Austin', 'round rock': 'Austin', 'cedar park': 'Austin', 'leander': 'Austin',
      // Florida
      'tampa': 'Tampa', 'st petersburg': 'Tampa', 'clearwater': 'Tampa',
      'miami': 'Miami', 'fort lauderdale': 'Miami', 'boca raton': 'Miami',
      // New York
      'new york': 'New York', 'manhattan': 'New York', 'brooklyn': 'New York', 'queens': 'New York',
      // North Carolina
      'charlotte': 'Charlotte',
      'raleigh': 'Research Triangle', 'durham': 'Research Triangle', 'chapel hill': 'Research Triangle',
    }

    const { data: allEvents } = await supabase
      .from('events')
      .select('id, city, state, metro_region')
      .eq('status', 'published')
      .is('deleted_at', null)

    let metroFixes = 0
    for (const evt of allEvents || []) {
      if (!evt.state || !evt.metro_region) continue
      const cityLower = (evt.city || '').toLowerCase().replace(/,.*$/, '').trim()

      // Check city-specific override first
      const cityMetro = CITY_METRO_FIX[cityLower]
      if (cityMetro && evt.metro_region !== cityMetro) {
        await supabase.from('events').update({ metro_region: cityMetro }).eq('id', evt.id)
        log(`Metro fix: ${evt.city}, ${evt.state}: ${evt.metro_region} → ${cityMetro}`)
        metroFixes++
        continue
      }

      // Check state default (only for single-metro states where current metro is wrong)
      const stateMetro = STATE_DEFAULT_METRO[evt.state]
      if (stateMetro && evt.metro_region !== stateMetro) {
        // Don't override multi-metro state defaults (CA, TX, FL, NY, NC already handled above)
        const multiMetroStates = ['California', 'CA', 'Texas', 'TX', 'Florida', 'FL', 'New York', 'NY', 'North Carolina', 'NC',
          'Georgia', 'GA', 'Arizona', 'AZ', 'Minnesota', 'MN', 'Pennsylvania', 'PA', 'New Jersey', 'NJ',
          'Virginia', 'VA', 'Maryland', 'MD', 'DC', 'Washington', 'WA']
        if (!multiMetroStates.includes(evt.state)) {
          await supabase.from('events').update({ metro_region: stateMetro }).eq('id', evt.id)
          log(`Metro fix: ${evt.city}, ${evt.state}: ${evt.metro_region} → ${stateMetro}`)
          metroFixes++
        }
      }
    }
    if (metroFixes > 0) {
      log(`Fixed ${metroFixes} metro_region mismatches`)
    } else {
      log('No metro_region mismatches found')
    }

    return NextResponse.json({ ok: true, logs })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`Unexpected error: ${msg}`)
    return NextResponse.json({ ok: false, error: msg, logs }, { status: 500 })
  }
}
