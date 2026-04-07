// scripts/migrate.js
// Run: npm run db:migrate
// Uses the DIRECT connection (no pooler) as required for DDL statements.

require('dotenv').config({ path: '.env.local' })
const { neon } = require('@neondatabase/serverless')

const connectionString = process.env.DATABASE_URL_DIRECT || process.env.DATABASE_URL
if (!connectionString) {
  console.error('ERROR: DATABASE_URL_DIRECT (or DATABASE_URL) is not set in .env.local')
  process.exit(1)
}

const sql = neon(connectionString)

async function migrate() {
  console.log('Running migrations...')

  // ── echoes table ────────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS echoes (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      text        TEXT        NOT NULL CHECK (char_length(text) BETWEEN 1 AND 280),
      mood        TEXT        NOT NULL CHECK (mood IN ('nostalgic','tender','longing','hopeful','bittersweet')),
      lat         DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90  AND 90),
      lng         DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at  TIMESTAMPTZ NOT NULL
    )
  `
  console.log('✓ echoes table ready')

  // ── reactions table ──────────────────────────────────────────
  await sql`
    CREATE TABLE IF NOT EXISTS reactions (
      id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
      echo_id     UUID        NOT NULL REFERENCES echoes(id) ON DELETE CASCADE,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `
  console.log('✓ reactions table ready')

  // ── indexes ──────────────────────────────────────────────────
  // Partial index — only live echoes are queried, so exclude expired rows
  await sql`
    CREATE INDEX IF NOT EXISTS idx_echoes_location
ON echoes (lat, lng)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_echoes_expires_at
    ON echoes (expires_at)
  `
  await sql`
    CREATE INDEX IF NOT EXISTS idx_reactions_echo_id
    ON reactions (echo_id)
  `
  console.log('✓ indexes ready')

  console.log('\n✅ Migration complete.')
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
