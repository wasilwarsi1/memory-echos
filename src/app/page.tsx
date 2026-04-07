'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { Echo, Mood } from '@/lib/db'

const MOODS: { value: Mood; label: string }[] = [
  { value: 'nostalgic',   label: 'nostalgic'   },
  { value: 'tender',      label: 'tender'      },
  { value: 'longing',     label: 'longing'     },
  { value: 'hopeful',     label: 'hopeful'     },
  { value: 'bittersweet', label: 'bittersweet' },
]

const MOOD_COLOR: Record<Mood, string> = {
  nostalgic:   '#c47aff',
  tender:      '#ff8aaa',
  longing:     '#7aaaff',
  hopeful:     '#7aeecc',
  bittersweet: '#ffb87a',
}

const MOOD_GLYPH: Record<Mood, string> = {
  nostalgic:   '◎',
  tender:      '♡',
  longing:     '◌',
  hopeful:     '✦',
  bittersweet: '◗',
}

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

function timeLeft(iso: string) {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000 / 3600
  if (diff < 1) return 'expires soon'
  return `${Math.floor(diff)}h left`
}

export default function Home() {
  const mapRef = useRef<HTMLDivElement>(null)
  const leafletMap = useRef<any>(null)
  const markersRef = useRef<any[]>([])

  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [geoError, setGeoError] = useState('')
  const [echoes, setEchoes] = useState<Echo[]>([])

  const [composing, setComposing] = useState(false)
  const [text, setText] = useState('')
  const [mood, setMood] = useState<Mood>('nostalgic')
  const [dropping, setDropping] = useState(false)

  const [selectedEcho, setSelectedEcho] = useState<Echo | null>(null)
  const [readerOpen, setReaderOpen] = useState(false)
  const [reactedIds, setReactedIds] = useState<Set<string>>(new Set())
  const [toast, setToast] = useState('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // ── 1. Get GPS ───────────────────────────────────────────────
  useEffect(() => {
    if (!navigator.geolocation) { setGeoError('Geolocation not supported.'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => setGeoError(`Location denied. (${err.message})`)
    )
  }, [])

  // ── 2. Fetch echoes ──────────────────────────────────────────
  const fetchEchoes = useCallback(async () => {
    if (!coords) return
    const res = await fetch(`/api/echoes?lat=${coords.lat}&lng=${coords.lng}`)
    const data = await res.json()
    if (res.ok) setEchoes(data.echoes)
  }, [coords])

  useEffect(() => { fetchEchoes() }, [fetchEchoes])

  // ── 3. Init Leaflet map ──────────────────────────────────────
  useEffect(() => {
    if (!coords || !mapRef.current || leafletMap.current) return

    import('leaflet').then((L) => {
      delete (L.Icon.Default.prototype as any)._getIconUrl
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
        iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
      })

      const map = L.map(mapRef.current!, {
        center: [coords.lat, coords.lng],
        zoom: 17,
        zoomControl: false,
      })

      // Dark dreamy tile layer
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '© OpenStreetMap © CARTO',
        maxZoom: 19,
      }).addTo(map)

      // User pulsing dot
      const userIcon = L.divIcon({
        className: '',
        html: `<div style="
          width:14px;height:14px;
          background:#e8d5ff;border-radius:50%;
          border:2px solid rgba(255,255,255,0.4);
          box-shadow:0 0 0 8px rgba(200,160,255,0.2),0 0 20px 6px rgba(160,100,255,0.4);
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      })
      L.marker([coords.lat, coords.lng], { icon: userIcon }).addTo(map)

      leafletMap.current = map
    })
  }, [coords])

  // ── 4. Place echo pins ───────────────────────────────────────
  useEffect(() => {
    if (!leafletMap.current || echoes.length === 0) return

    import('leaflet').then((L) => {
      markersRef.current.forEach((m) => m.remove())
      markersRef.current = []

      echoes.forEach((echo) => {
        const color = MOOD_COLOR[echo.mood]
        const glyph = MOOD_GLYPH[echo.mood]

        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:36px;height:36px;
            background:${color}22;
            border:1.5px solid ${color}88;
            border-radius:50%;
            display:flex;align-items:center;justify-content:center;
            font-size:14px;cursor:pointer;
            box-shadow:0 0 12px 2px ${color}44;
          "><span style="color:${color}">${glyph}</span></div>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        })

        const marker = L.marker([echo.lat, echo.lng], { icon })
          .addTo(leafletMap.current)
          .on('click', () => {
            setSelectedEcho(echo)
            setReaderOpen(false)
            setComposing(false)
          })

        markersRef.current.push(marker)
      })
    })
  }, [echoes])

  // ── 5. Drop echo ─────────────────────────────────────────────
  async function dropEcho() {
    if (!coords || !text.trim()) return
    setDropping(true)
    try {
      const res = await fetch('/api/echoes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim(), mood, lat: coords.lat, lng: coords.lng }),
      })
      const data = await res.json()
      if (res.ok) {
        setEchoes((prev) => [data.echo, ...prev])
        setText('')
        setComposing(false)
        showToast('Echo released ✦')
      }
    } finally {
      setDropping(false)
    }
  }

  // ── 6. React ─────────────────────────────────────────────────
  async function react(echoId: string) {
    if (reactedIds.has(echoId)) return
    setReactedIds((prev) => new Set([...prev, echoId]))
    await fetch(`/api/echoes/${echoId}/react`, { method: 'POST' })
    setEchoes((prev) =>
      prev.map((e) => e.id === echoId ? { ...e, reaction_count: (e.reaction_count ?? 0) + 1 } : e)
    )
    if (selectedEcho?.id === echoId) {
      setSelectedEcho((prev) => prev ? { ...prev, reaction_count: (prev.reaction_count ?? 0) + 1 } : prev)
    }
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(''), 3000)
  }

  const reacted = selectedEcho ? reactedIds.has(selectedEcho.id) : false

  return (
    <main style={s.app}>
      {/* Map */}
      <div ref={mapRef} style={s.map} />

      {/* Dreamy nebula overlays */}
      <div style={s.nebula1} />
      <div style={s.nebula2} />

      {/* Header */}
      <header style={s.header}>
        <div style={s.logo}>memory <em style={{ color: 'rgba(200,160,255,0.75)' }}>echoes</em></div>
        <div style={s.pill}>
          <span style={s.liveDot} />
          {echoes.length} nearby
        </div>
      </header>

      {geoError && <div style={s.geoWarn}>{geoError}</div>}

      {/* Bottom veil */}
      <div style={s.veil} />

      {/* Bottom controls */}
      <div style={s.bottomArea}>
        {composing && (
          <div style={s.sheet}>
            <p style={s.sheetHint}>leave something behind</p>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={280}
              placeholder="Something about this place..."
              style={s.textarea}
              autoFocus
            />
            <div style={s.moodRow}>
              {MOODS.map((m) => (
                <button key={m.value} onClick={() => setMood(m.value)}
                  style={{ ...s.chip, ...(mood === m.value ? s.chipOn : {}) }}>
                  {m.label}
                </button>
              ))}
            </div>
            <div style={s.sheetFoot}>
              <span style={s.locTag}>✦ anchored to your location</span>
              <button onClick={dropEcho} disabled={!text.trim() || dropping || !coords} style={s.releaseBtn}>
                {dropping ? 'Releasing…' : 'Release'}
              </button>
            </div>
          </div>
        )}

        <div style={s.actionRow}>
          <button style={s.tray} onClick={() => { setReaderOpen(true); setSelectedEcho(null); setComposing(false) }}>
            <span style={s.trayIcon}>✦</span>
            <div style={s.trayTexts}>
              <span style={s.trayMain}>{echoes.length} echoes drifting nearby</span>
              <span style={s.traySub}>within 100m · tap to see all</span>
            </div>
            <span style={{ color: 'rgba(160,130,210,0.4)', fontSize: 20 }}>›</span>
          </button>
          <button
            style={{ ...s.fab, ...(composing ? s.fabOpen : {}) }}
            onClick={() => { setComposing(v => !v); setSelectedEcho(null); setReaderOpen(false) }}
          >
            <span style={{ ...s.fabIcon, transform: composing ? 'rotate(45deg)' : 'none' }}>+</span>
          </button>
        </div>
      </div>

      {/* Single echo modal — tap a pin to open this */}
      {selectedEcho && (
        <div style={s.overlay} onClick={() => setSelectedEcho(null)}>
          <div style={s.modal} onClick={(e) => e.stopPropagation()}>
            <button style={s.closeBtn} onClick={() => setSelectedEcho(null)}>×</button>
            <div style={s.modalMoodRow}>
              <div style={{ ...s.gem, background: MOOD_COLOR[selectedEcho.mood] }} />
              <span style={{ ...s.moodLabel, color: MOOD_COLOR[selectedEcho.mood] }}>
                {selectedEcho.mood}
              </span>
            </div>
            <p style={s.modalText}>"{selectedEcho.text}"</p>
            <div style={s.modalMeta}>
              <span>{timeAgo(selectedEcho.created_at)}</span>
              <span style={s.metaDot}>·</span>
              <span>{selectedEcho.distance_m}m away</span>
              <span style={s.metaDot}>·</span>
              <span>{timeLeft(selectedEcho.expires_at)}</span>
            </div>
            <div style={s.modalFoot}>
              <button
                style={{ ...s.feltBtn, ...(reacted ? s.feltBtnOn : {}) }}
                onClick={() => react(selectedEcho.id)}
              >
                {reacted
                  ? `felt this (${selectedEcho.reaction_count ?? 1})`
                  : `felt this${selectedEcho.reaction_count ? ` (${selectedEcho.reaction_count})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Echo list drawer */}
      {readerOpen && !selectedEcho && (
        <div style={s.drawer}>
          <div style={s.drawerTop}>
            <span style={s.drawerLabel}>Echoes nearby</span>
            <button style={s.closeOrb} onClick={() => setReaderOpen(false)}>×</button>
          </div>
          <div style={s.drawerScroll}>
            {echoes.length === 0 && (
              <p style={{ color: 'rgba(160,130,210,0.5)', fontSize: 14, textAlign: 'center', marginTop: 40 }}>
                No echoes here yet. Be the first.
              </p>
            )}
            {echoes.map((e) => {
              const color = MOOD_COLOR[e.mood]
              return (
                <button key={e.id} style={s.echoRow}
                  onClick={() => { setSelectedEcho(e); setReaderOpen(false) }}>
                  <div style={{ ...s.rowGem, background: color }} />
                  <div style={s.rowTexts}>
                    <span style={{ ...s.rowMood, color }}>{e.mood}</span>
                    <span style={s.rowPreview}>
                      {e.text.length > 60 ? e.text.slice(0, 60) + '…' : e.text}
                    </span>
                  </div>
                  <div style={s.rowMeta}>
                    <span>{e.distance_m}m</span>
                    <span style={{ marginTop: 2, opacity: 0.5 }}>{timeAgo(e.created_at)}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {toast && <div style={s.toast}>{toast}</div>}
    </main>
  )
}

const s: Record<string, React.CSSProperties> = {
  app: {
    position: 'relative', width: '100%', height: '100dvh',
    overflow: 'hidden', background: '#0d0a14',
    fontFamily: "'DM Sans', -apple-system, sans-serif",
    color: 'rgba(232,213,255,0.9)',
  },
  map: { position: 'absolute', inset: 0, zIndex: 0 },
  nebula1: {
    position: 'absolute', width: 340, height: 260, left: -60, top: -40,
    borderRadius: '50%', pointerEvents: 'none', zIndex: 1,
    background: 'radial-gradient(ellipse, rgba(120,60,180,0.13) 0%, transparent 70%)',
  },
  nebula2: {
    position: 'absolute', width: 420, height: 300, right: -80, top: 80,
    borderRadius: '50%', pointerEvents: 'none', zIndex: 1,
    background: 'radial-gradient(ellipse, rgba(60,100,200,0.08) 0%, transparent 70%)',
  },
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '20px 20px 0',
    background: 'linear-gradient(to bottom, rgba(13,10,20,0.85) 0%, transparent 100%)',
  },
  logo: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontWeight: 300, fontSize: 20, letterSpacing: '0.04em',
  },
  pill: {
    display: 'flex', alignItems: 'center', gap: 7,
    background: 'rgba(160,100,255,0.12)', border: '1px solid rgba(160,100,255,0.25)',
    borderRadius: 30, padding: '6px 14px', fontSize: 11, color: 'rgba(200,160,255,0.85)',
  },
  liveDot: {
    display: 'inline-block', width: 5, height: 5, background: '#c88aff', borderRadius: '50%',
  },
  geoWarn: {
    position: 'absolute', top: 70, left: 16, right: 16, zIndex: 30,
    background: 'rgba(255,80,80,0.15)', border: '1px solid rgba(255,80,80,0.3)',
    borderRadius: 12, padding: '10px 14px', fontSize: 13, color: 'rgba(255,160,160,0.9)',
  },
  veil: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: 240,
    background: 'linear-gradient(to top, rgba(13,10,20,0.95) 0%, transparent 100%)',
    pointerEvents: 'none', zIndex: 5,
  },
  bottomArea: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    zIndex: 20, padding: '0 16px 20px',
  },
  sheet: {
    background: 'rgba(18,13,28,0.95)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 22, padding: 20, marginBottom: 12, backdropFilter: 'blur(30px)',
  },
  sheetHint: {
    fontSize: 10, fontWeight: 500, letterSpacing: '0.12em',
    textTransform: 'uppercase', color: 'rgba(200,160,255,0.35)', marginBottom: 10,
  },
  textarea: {
    width: '100%', background: 'transparent', border: 'none', outline: 'none',
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontStyle: 'italic', fontSize: 17, fontWeight: 300,
    color: 'rgba(240,230,255,0.92)', lineHeight: 1.7, minHeight: 68, resize: 'none',
  },
  moodRow: { display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap' },
  chip: {
    border: '1px solid rgba(255,255,255,0.1)', borderRadius: 30,
    padding: '5px 13px', fontSize: 11, color: 'rgba(200,180,240,0.45)',
    cursor: 'pointer', background: 'transparent', fontFamily: 'inherit',
  },
  chipOn: { background: 'rgba(160,100,255,0.15)', borderColor: 'rgba(160,100,255,0.5)', color: '#c88aff' },
  sheetFoot: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.05)',
  },
  locTag: { fontSize: 11, color: 'rgba(160,130,210,0.4)' },
  releaseBtn: {
    background: 'rgba(160,100,255,0.85)', color: '#f0e8ff', border: 'none',
    borderRadius: 14, padding: '9px 22px', fontSize: 12, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  actionRow: { display: 'flex', alignItems: 'center', gap: 12 },
  tray: {
    flex: 1, background: 'rgba(18,13,28,0.9)', border: '1px solid rgba(255,255,255,0.07)',
    borderRadius: 18, padding: '12px 16px', display: 'flex', alignItems: 'center',
    gap: 10, cursor: 'pointer', color: 'inherit', textAlign: 'left',
    backdropFilter: 'blur(20px)',
  },
  trayIcon: {
    width: 34, height: 34, background: 'rgba(120,70,200,0.2)',
    borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 15, flexShrink: 0,
  },
  trayTexts: { flex: 1, display: 'flex', flexDirection: 'column', gap: 2 },
  trayMain: { fontSize: 13, fontWeight: 500, color: 'rgba(230,215,255,0.9)' },
  traySub: { fontSize: 11, color: 'rgba(160,130,210,0.5)' },
  fab: {
    width: 52, height: 52, borderRadius: '50%',
    background: 'rgba(160,100,255,0.85)', border: 'none',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 0 20px 4px rgba(160,100,255,0.3)', flexShrink: 0, transition: 'all 0.25s',
  },
  fabOpen: { background: 'rgba(80,40,140,0.9)', boxShadow: '0 0 16px 4px rgba(80,40,140,0.3)' },
  fabIcon: { fontSize: 24, color: '#f0e8ff', fontWeight: 300, lineHeight: 1, display: 'block', transition: 'transform 0.3s' },
  overlay: {
    position: 'absolute', inset: 0, zIndex: 100,
    background: 'rgba(5,3,12,0.75)', backdropFilter: 'blur(8px)',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    padding: '0 16px 110px',
  },
  modal: {
    width: '100%', maxWidth: 480,
    background: 'rgba(18,13,30,0.98)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 24, padding: '24px 24px 20px', position: 'relative',
  },
  closeBtn: {
    position: 'absolute', top: 16, right: 16,
    width: 30, height: 30, borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)', border: 'none',
    cursor: 'pointer', color: 'rgba(200,180,240,0.7)',
    fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit',
  },
  modalMoodRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 },
  gem: { width: 8, height: 8, borderRadius: '50%' },
  moodLabel: { fontSize: 10, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase' },
  modalText: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontStyle: 'italic', fontWeight: 300, fontSize: 19,
    lineHeight: 1.7, color: 'rgba(240,230,255,0.92)', marginBottom: 16,
  },
  modalMeta: {
    display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 11, color: 'rgba(160,130,210,0.5)', marginBottom: 18,
  },
  metaDot: { opacity: 0.4 },
  modalFoot: { display: 'flex', justifyContent: 'flex-end' },
  feltBtn: {
    background: 'transparent', border: '1px solid rgba(160,100,255,0.25)',
    borderRadius: 20, padding: '7px 20px', fontSize: 12,
    color: 'rgba(160,100,255,0.6)', cursor: 'pointer', fontFamily: 'inherit',
  },
  feltBtnOn: { background: 'rgba(160,100,255,0.15)', borderColor: 'rgba(160,100,255,0.5)', color: '#c088ff' },
  drawer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 50,
    background: 'rgba(12,9,22,0.98)', borderRadius: '24px 24px 0 0',
    border: '1px solid rgba(255,255,255,0.06)', borderBottom: 'none',
    maxHeight: '70vh', display: 'flex', flexDirection: 'column',
  },
  drawerTop: {
    padding: '20px 20px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0,
  },
  drawerLabel: { fontSize: 10, fontWeight: 500, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(160,130,210,0.5)' },
  closeOrb: {
    width: 30, height: 30, borderRadius: '50%',
    background: 'rgba(255,255,255,0.06)', border: 'none',
    cursor: 'pointer', color: 'rgba(200,180,240,0.7)',
    fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit',
  },
  drawerScroll: { flex: 1, overflowY: 'auto', padding: '8px 16px 24px', display: 'flex', flexDirection: 'column', gap: 4 },
  echoRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 14px', borderRadius: 14,
    background: 'transparent', border: 'none', cursor: 'pointer',
    color: 'inherit', textAlign: 'left', width: '100%',
  },
  rowGem: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  rowTexts: { flex: 1, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 },
  rowMood: { fontSize: 10, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.8 },
  rowPreview: {
    fontSize: 13, color: 'rgba(220,210,240,0.7)',
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  rowMeta: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: 11, color: 'rgba(160,130,210,0.5)', flexShrink: 0 },
  toast: {
    position: 'absolute', top: 76, left: '50%', transform: 'translateX(-50%)',
    background: 'rgba(120,60,200,0.92)', color: '#f0e8ff',
    borderRadius: 30, padding: '10px 22px', fontSize: 12,
    fontWeight: 500, zIndex: 200, whiteSpace: 'nowrap', pointerEvents: 'none',
  },
}