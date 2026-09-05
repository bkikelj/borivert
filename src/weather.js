// Vremenska prognoza preko Open-Meteo (besplatno, bez API kljuca). Prognoza za
// tocan datum radi samo do ~15 dana unaprijed (koliko Open-Meteo nudi) - za
// utrke dalje u buducnosti prikazujemo samo poruku da ce prognoza doci kasnije.

const WMO_OPISI = {
  0: 'vedro', 1: 'pretežno vedro', 2: 'djelomično oblačno', 3: 'oblačno',
  45: 'magla', 48: 'magla s injem',
  51: 'slaba rosulja', 53: 'rosulja', 55: 'jaka rosulja',
  61: 'slaba kiša', 63: 'kiša', 65: 'jaka kiša',
  66: 'ledena kiša', 67: 'jaka ledena kiša',
  71: 'slab snijeg', 73: 'snijeg', 75: 'jak snijeg', 77: 'snježna zrna',
  80: 'slabi pljuskovi', 81: 'pljuskovi', 82: 'jaki pljuskovi',
  85: 'slabi snježni pljuskovi', 86: 'jaki snježni pljuskovi',
  95: 'grmljavinsko nevrijeme', 96: 'nevrijeme s tučom', 99: 'jako nevrijeme s tučom',
}

export function opisVremena(code) {
  return WMO_OPISI[code] || 'nepoznato'
}

export async function geocodeMjesto(naziv) {
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(naziv)}&count=1&language=hr&format=json`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Geokodiranje nije uspjelo (HTTP ${res.status}).`)
  const data = await res.json()
  const r = data.results?.[0]
  if (!r) return null
  return { lat: r.latitude, lon: r.longitude, naziv: r.name, drzava: r.country }
}

export async function dohvatiProgozu(lat, lon, datumISO) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max,windspeed_10m_max` +
    `&timezone=auto&start_date=${datumISO}&end_date=${datumISO}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Dohvat prognoze nije uspio (HTTP ${res.status}).`)
  const data = await res.json()
  const d = data.daily
  if (!d || !d.time?.length) return null
  return {
    code: d.weathercode[0],
    tMax: Math.round(d.temperature_2m_max[0]),
    tMin: Math.round(d.temperature_2m_min[0]),
    oborine: d.precipitation_probability_max[0],
    vjetar: Math.round(d.windspeed_10m_max[0]),
  }
}
