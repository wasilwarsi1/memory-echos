# Memory Echoes

> Drop anonymous emotional memories tied to real-world GPS coordinates. Others discover them when physically nearby.

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| Database | Neon (serverless Postgres) |
| Hosting | Vercel |
| CI/CD | GitHub Actions → Vercel |

---

## Local Setup

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/memory-echoes.git
cd memory-echoes
npm install
```

### 2. Create your Neon database

1. Go to [console.neon.tech](https://console.neon.tech) and sign up (free tier works)
2. Click **New Project** → give it a name → **Create**
3. Click **Connect** on the dashboard
4. Copy the **pooled** connection string (contains `-pooler` in the hostname)
5. Also copy the **direct** connection string (no pooler, needed for migrations)

### 3. Configure environment

```bash
cp .env.local.example .env.local
```

Open `.env.local` and paste your two connection strings:

```
DATABASE_URL="postgresql://USER:PASS@ep-xxxx-pooler.region.aws.neon.tech/neondb?sslmode=require"
DATABASE_URL_DIRECT="postgresql://USER:PASS@ep-xxxx.region.aws.neon.tech/neondb?sslmode=require"
```

### 4. Run migrations

```bash
npm run db:migrate
```

This creates the `echoes` and `reactions` tables and all indexes.

### 5. (Optional) Seed test data

```bash
npm run db:seed
# Or with a custom location:
SEED_LAT=28.6139 SEED_LNG=77.2090 npm run db:seed
```

### 6. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Allow location access when prompted.

---

## API Reference

### `GET /api/echoes?lat=XX&lng=XX`

Returns all live echoes within 100m of the given coordinates.

```json
{
  "echoes": [
    {
      "id": "uuid",
      "text": "Something about this place...",
      "mood": "nostalgic",
      "lat": 51.507,
      "lng": -0.127,
      "created_at": "2025-01-01T12:00:00Z",
      "expires_at": "2025-01-02T12:00:00Z",
      "distance_m": 42,
      "reaction_count": 3
    }
  ],
  "count": 1
}
```

### `POST /api/echoes`

Drop a new echo at the given coordinates.

```json
{
  "text": "Something about this place...",
  "mood": "nostalgic",
  "lat": 51.507,
  "lng": -0.127
}
```

Valid moods: `nostalgic`, `tender`, `longing`, `hopeful`, `bittersweet`

### `POST /api/echoes/:id/react`

Increment the "felt this" count for an echo.

### `GET /api/cron/purge`

Deletes all expired echoes. Called automatically by Vercel Cron every hour.

---

## Deploy to Vercel

### First deploy

1. Push this repo to GitHub
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import your GitHub repo
4. In **Environment Variables**, add:
   - `DATABASE_URL` — your Neon pooled connection string
   - `CRON_SECRET` — any random string (protects the purge endpoint)
5. Click **Deploy**

### After first deploy

1. Set `NEXT_PUBLIC_APP_URL` in Vercel to your production URL
2. Vercel Cron runs `/api/cron/purge` every hour automatically (configured in `vercel.json`)

### Subsequent deploys

Push to `main` → Vercel auto-deploys. Done.

---

## Database Schema

```sql
-- echoes: one row per memory dropped
CREATE TABLE echoes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text       TEXT NOT NULL CHECK (char_length(text) BETWEEN 1 AND 280),
  mood       TEXT NOT NULL CHECK (mood IN ('nostalgic','tender','longing','hopeful','bittersweet')),
  lat        DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
  lng        DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- reactions: "felt this" clicks — one per press (no auth, by design)
CREATE TABLE reactions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  echo_id    UUID NOT NULL REFERENCES echoes(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Proximity query** uses pure SQL Haversine — no PostGIS extension required.
**Neon free tier** gives you 0.5 GB storage and auto-suspends when idle. Perfect for MVP.

---

## Roadmap

- [ ] Mapbox GL map with real pin positions
- [ ] Rate limiting (1 echo per 10 min per IP)
- [ ] Push notifications for new nearby echoes
- [ ] Mood-based filter in the reader
- [ ] Echo clustering when many overlap
