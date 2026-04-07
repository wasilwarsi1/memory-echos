import { sql, type CreateEchoInput, type Echo } from './db'

const RADIUS_M = Number(process.env.ECHO_RADIUS_METERS ?? 100)

export async function createEcho(input: CreateEchoInput): Promise<Echo> {
  const { text, mood, lat, lng } = input

  const rows = await sql`
    INSERT INTO echoes (text, mood, lat, lng, expires_at)
    VALUES (
      ${text},
      ${mood},
      ${lat},
      ${lng},
      NOW() + INTERVAL '24 hours'
    )
    RETURNING id, text, mood, lat, lng, created_at, expires_at
  `
  return rows[0] as Echo
}

export async function getNearbyEchoes(lat: number, lng: number, limitN = 50): Promise<Echo[]> {
  const rows = await sql`
    SELECT
      id, text, mood, lat, lng, created_at, expires_at,
      ROUND(
        6371000 * ACOS(
          LEAST(1.0,
            COS(RADIANS(${lat})) * COS(RADIANS(lat)) *
            COS(RADIANS(lng) - RADIANS(${lng})) +
            SIN(RADIANS(${lat})) * SIN(RADIANS(lat))
          )
        )
      )::int AS distance_m,
      (SELECT COUNT(*)::int FROM reactions r WHERE r.echo_id = echoes.id) AS reaction_count
    FROM echoes
    WHERE
      expires_at > NOW()
      AND 6371000 * ACOS(
        LEAST(1.0,
          COS(RADIANS(${lat})) * COS(RADIANS(lat)) *
          COS(RADIANS(lng) - RADIANS(${lng})) +
          SIN(RADIANS(${lat})) * SIN(RADIANS(lat))
        )
      ) <= ${RADIUS_M}
    ORDER BY created_at DESC
    LIMIT ${limitN}
  `
  return rows as Echo[]
}

export async function addReaction(echoId: string): Promise<{ count: number }> {
  await sql`
    INSERT INTO reactions (echo_id)
    VALUES (${echoId})
    ON CONFLICT DO NOTHING
  `
  const rows = await sql`
    SELECT COUNT(*)::int AS count FROM reactions WHERE echo_id = ${echoId}
  `
  return rows[0] as { count: number }
}

export async function purgeExpiredEchoes(): Promise<{ deleted: number }> {
  const rows = await sql`
    WITH deleted AS (
      DELETE FROM echoes WHERE expires_at <= NOW() RETURNING id
    )
    SELECT COUNT(*)::int AS deleted FROM deleted
  `
  return rows[0] as { deleted: number }
}
