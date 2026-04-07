import { neon } from '@neondatabase/serverless'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set. Copy .env.local.example to .env.local and fill in your Neon credentials.')
}

// Pooled connection — for all API routes (handles concurrent serverless invocations)
export const sql = neon(process.env.DATABASE_URL)

// ─── Types ───────────────────────────────────────────────────

export type Mood = 'nostalgic' | 'tender' | 'longing' | 'hopeful' | 'bittersweet'

export interface Echo {
  id: string
  text: string
  mood: Mood
  lat: number
  lng: number
  created_at: string
  expires_at: string
  distance_m?: number    // populated by nearby query
  reaction_count?: number
}

export interface CreateEchoInput {
  text: string
  mood: Mood
  lat: number
  lng: number
}
