// Parsiranje GPX datoteke (XML) u nizu tocaka {lat, lon, ele} i racunanje osnovne
// statistike staze (duljina, visinska razlika). Sve radimo u pregledniku - GPX
// je obican XML pa nam ne treba posebna biblioteka za citanje.

export function parseGpx(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml')
  if (doc.querySelector('parsererror')) {
    throw new Error('Datoteka nije valjan GPX/XML.')
  }
  const trkpts = [...doc.querySelectorAll('trkpt')]
  const points = trkpts
    .map((pt) => {
      const lat = parseFloat(pt.getAttribute('lat'))
      const lon = parseFloat(pt.getAttribute('lon'))
      const eleText = pt.querySelector('ele')?.textContent
      const ele = eleText != null ? parseFloat(eleText) : null
      return { lat, lon, ele }
    })
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon))
  if (points.length === 0) {
    throw new Error('U datoteci nisam pronašao GPS točke staze (trkpt).')
  }
  return points
}

// Haversine udaljenost izmedju dvije tocke u kilometrima.
function haversineKm(a, b) {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLon = ((b.lon - a.lon) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const sinDLat = Math.sin(dLat / 2)
  const sinDLon = Math.sin(dLon / 2)
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)))
}

// GPS visina zna "skakati" +/- par metara i bez pravog uspona/spusta, pa prije
// zbrajanja uspona blago izgladimo visinu (pomicni prosjek) da ne precijenimo m+.
function smoothElevations(points, window = 5) {
  const eles = points.map((p) => p.ele)
  const smoothed = eles.map((_, i) => {
    const from = Math.max(0, i - window)
    const to = Math.min(eles.length, i + window + 1)
    const slice = eles.slice(from, to).filter((e) => Number.isFinite(e))
    if (slice.length === 0) return null
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
  return smoothed
}

// Vraca tocke obogacene kumulativnom udaljenoscu (km) - koristi i karta i graf uspona.
export function withCumulativeDistance(points) {
  let total = 0
  return points.map((p, i) => {
    if (i > 0) total += haversineKm(points[i - 1], p)
    return { ...p, km: total }
  })
}

export function computeTrackStats(points) {
  const withDist = withCumulativeDistance(points)
  const distanceKm = withDist[withDist.length - 1]?.km ?? 0

  const smoothed = smoothElevations(points)
  let gainM = 0
  let lossM = 0
  for (let i = 1; i < smoothed.length; i++) {
    const prev = smoothed[i - 1]
    const curr = smoothed[i]
    if (prev == null || curr == null) continue
    const diff = curr - prev
    if (diff > 0) gainM += diff
    else lossM += -diff
  }

  const rawEles = points.map((p) => p.ele).filter((e) => Number.isFinite(e))
  const minEle = rawEles.length ? Math.min(...rawEles) : null
  const maxEle = rawEles.length ? Math.max(...rawEles) : null

  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    gainM: Math.round(gainM),
    lossM: Math.round(lossM),
    minEle: minEle != null ? Math.round(minEle) : null,
    maxEle: maxEle != null ? Math.round(maxEle) : null,
    points: withDist,
  }
}
