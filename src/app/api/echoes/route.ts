import { NextRequest, NextResponse } from 'next/server'
import { createEcho, getNearbyEchoes } from '@/lib/echoes'
import type { Mood } from '@/lib/db'

const VALID_MOODS: Mood[] = ['nostalgic', 'tender', 'longing', 'hopeful', 'bittersweet']

// ─── GET /api/echoes?lat=XX&lng=XX ───────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl

  const lat = parseFloat(searchParams.get('lat') ?? '')
  const lng = parseFloat(searchParams.get('lng') ?? '')

  if (isNaN(lat) || isNaN(lng)) {
    return NextResponse.json(
      { error: 'lat and lng query params are required and must be numbers.' },
      { status: 400 }
    )
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    return NextResponse.json(
      { error: 'lat must be -90..90, lng must be -180..180.' },
      { status: 400 }
    )
  }

  try {
    const echoes = await getNearbyEchoes(lat, lng)
    return NextResponse.json({ echoes, count: echoes.length })
  } catch (err) {
    console.error('[GET /api/echoes]', err)
    return NextResponse.json({ error: 'Failed to fetch echoes.' }, { status: 500 })
  }
}

// ─── POST /api/echoes ─────────────────────────────────────────

export async function POST(req: NextRequest) {
  let body: unknown

  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  const { text, mood, lat, lng } = body as Record<string, unknown>

  // Validate
  if (typeof text !== 'string' || text.trim().length === 0) {
    return NextResponse.json({ error: 'text is required.' }, { status: 400 })
  }
  if (text.trim().length > 280) {
    return NextResponse.json({ error: 'text must be 280 characters or fewer.' }, { status: 400 })
  }
  if (!VALID_MOODS.includes(mood as Mood)) {
    return NextResponse.json(
      { error: `mood must be one of: ${VALID_MOODS.join(', ')}` },
      { status: 400 }
    )
  }
  const latN = parseFloat(String(lat))
  const lngN = parseFloat(String(lng))
  if (isNaN(latN) || isNaN(lngN)) {
    return NextResponse.json({ error: 'lat and lng must be numbers.' }, { status: 400 })
  }

  try {
    const echo = await createEcho({
      text: text.trim(),
      mood: mood as Mood,
      lat: latN,
      lng: lngN,
    })
    return NextResponse.json({ echo }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/echoes]', err)
    return NextResponse.json({ error: 'Failed to create echo.' }, { status: 500 })
  }
}
