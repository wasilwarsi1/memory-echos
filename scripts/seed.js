// scripts/seed.js
// Run: npm run db:seed
// Seeds 10 demo echoes around a central test coordinate (London by default).
// Override with: SEED_LAT=28.6139 SEED_LNG=77.2090 npm run db:seed

require('dotenv').config({ path: '.env.local' })
const { neon } = require('@neondatabase/serverless')

const sql = neon(process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL)

const BASE_LAT = parseFloat(process.env.SEED_LAT || '51.5074')
const BASE_LNG = parseFloat(process.env.SEED_LNG || '-0.1278')

function jitter(deg, maxM = 80) {
  // 1 degree lat ≈ 111,111 m
  return deg + (Math.random() - 0.5) * (maxM / 111111) * 2
}

const SEEDS = [
  { mood: 'nostalgic', text: 'I kissed someone here on a rainy Tuesday. We thought it was funny.', hoursAgo: 2 },
  { mood: 'longing',   text: 'My grandfather sat on that bench every morning until last spring. I still expect to see him.', hoursAgo: 5 },
  { mood: 'hopeful',   text: 'Got the call here. I screamed. Nobody looked.', hoursAgo: 8 },
  { mood: 'bittersweet', text: 'Six months of walking past this door, never going in.', hoursAgo: 11 },
  { mood: 'tender',    text: 'We said goodbye here. Both pretended it wasn\'t the last time.', hoursAgo: 14 },
  { mood: 'nostalgic', text: 'There was a bookshop where this pharmacy stands. I found my favorite book there at eleven.', hoursAgo: 18 },
  { mood: 'hopeful',   text: 'A stranger said I had a beautiful smile. I needed that more than anything.', hoursAgo: 22 },
  { mood: 'tender',    text: 'My daughter took her first steps right here. She had no idea.', hoursAgo: 3 },
  { mood: 'longing',   text: 'We used to meet here every Friday. I don\'t know why we stopped.', hoursAgo: 7 },
  { mood: 'bittersweet', text: 'I cried in this doorway for twenty minutes and then walked in and ordered a coffee.', hoursAgo: 10 },
]

async function seed() {
  console.log(`Seeding 10 echoes around (${BASE_LAT}, ${BASE_LNG})...\n`)

  for (const s of SEEDS) {
    const lat = jitter(BASE_LAT)
    const lng = jitter(BASE_LNG)
    const created = new Date(Date.now() - s.hoursAgo * 3600 * 1000)
    const expires = new Date(created.getTime() + 24 * 3600 * 1000)

    await sql`
      INSERT INTO echoes (text, mood, lat, lng, created_at, expires_at)
      VALUES (${s.text}, ${s.mood}, ${lat}, ${lng}, ${created.toISOString()}, ${expires.toISOString()})
    `
    console.log(`  ✓ [${s.mood}] ${s.text.slice(0, 50)}…`)
  }

  console.log('\n✅ Seed complete.')
}

seed().catch((err) => {
  console.error('Seed failed:', err)
  process.exit(1)
})
