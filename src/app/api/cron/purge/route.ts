import { NextRequest, NextResponse } from 'next/server'
import { purgeExpiredEchoes } from '@/lib/echoes'

// GET /api/cron/purge
// Called by Vercel Cron (configured in vercel.json) — protected by CRON_SECRET
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (secret && auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await purgeExpiredEchoes()
    console.log(`[cron/purge] Deleted ${result.deleted} expired echoes.`)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    console.error('[cron/purge]', err)
    return NextResponse.json({ error: 'Purge failed.' }, { status: 500 })
  }
}
