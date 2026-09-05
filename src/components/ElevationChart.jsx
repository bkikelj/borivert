// Jednostavan graf visinskog profila (SVG, bez dodatne biblioteke za grafove).
// Prima tocke obogacene kumulativnom udaljenoscu (vidi src/gpx.js).

export default function ElevationChart({ points }) {
  const valjane = points.filter((p) => Number.isFinite(p.ele))
  if (valjane.length < 2) return null

  const width = 600
  const height = 160
  const padding = { top: 10, right: 10, bottom: 22, left: 34 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const maxKm = valjane[valjane.length - 1].km || 1
  const eles = valjane.map((p) => p.ele)
  const minEle = Math.min(...eles)
  const maxEle = Math.max(...eles)
  const raspon = Math.max(maxEle - minEle, 10) // izbjegni dijeljenje s ~0 na ravnoj stazi

  const x = (km) => padding.left + (km / maxKm) * plotW
  const y = (ele) => padding.top + plotH - ((ele - minEle) / raspon) * plotH

  const linija = valjane.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.km).toFixed(1)},${y(p.ele).toFixed(1)}`).join(' ')
  const ispuna = `${linija} L${x(valjane[valjane.length - 1].km).toFixed(1)},${(padding.top + plotH).toFixed(1)} L${x(0).toFixed(1)},${(padding.top + plotH).toFixed(1)} Z`

  const oznakeKm = []
  const brojOznaka = Math.min(6, Math.max(2, Math.round(maxKm / 5)))
  for (let i = 0; i <= brojOznaka; i++) {
    oznakeKm.push(Math.round((maxKm * i) / brojOznaka))
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Visinski profil staze">
      <defs>
        <linearGradient id="elevacija-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.03" />
        </linearGradient>
      </defs>

      {/* vodoravne vodilice + oznake visine */}
      {[minEle, (minEle + maxEle) / 2, maxEle].map((v, i) => (
        <g key={i}>
          <line x1={padding.left} x2={width - padding.right} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth="1" />
          <text x={padding.left - 6} y={y(v)} textAnchor="end" dominantBaseline="middle" fontSize="9" fill="var(--color-muted)">
            {Math.round(v)}
          </text>
        </g>
      ))}

      <path d={ispuna} fill="url(#elevacija-fill)" stroke="none" />
      <path d={linija} fill="none" stroke="var(--color-accent)" strokeWidth="1.75" strokeLinejoin="round" />

      {oznakeKm.map((km) => (
        <text key={km} x={x(km)} y={height - 6} textAnchor="middle" fontSize="9" fill="var(--color-muted)">
          {km} km
        </text>
      ))}
    </svg>
  )
}
