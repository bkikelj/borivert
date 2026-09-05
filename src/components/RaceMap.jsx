import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// Popravak poznatog Leaflet+bundler problema: zadane ikonice markera se ne
// ucitaju kroz Vite jer se putanje racunaju pogresno, pa ih postavimo rucno.
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'

delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
})

// Karta staze (Leaflet + OpenStreetMap - besplatno, bez API kljuca). Koristimo
// obican Leaflet (ne react-leaflet) da izbjegnemo pitanja kompatibilnosti s
// najnovijim Reactom; kartu sami stvaramo/rusimo kroz useEffect.
export default function RaceMap({ points }) {
  const divRef = useRef(null)
  const mapRef = useRef(null)

  useEffect(() => {
    if (!divRef.current || points.length === 0) return

    const map = L.map(divRef.current, { scrollWheelZoom: false })
    mapRef.current = map

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const latLngs = points.map((p) => [p.lat, p.lon])
    const linija = L.polyline(latLngs, { color: '#3e6690', weight: 4 }).addTo(map)
    L.marker(latLngs[0]).addTo(map).bindPopup('Start')
    L.marker(latLngs[latLngs.length - 1]).addTo(map).bindPopup('Cilj')

    map.fitBounds(linija.getBounds(), { padding: [16, 16] })

    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [points])

  if (points.length === 0) return null

  return <div ref={divRef} className="h-72 w-full rounded-xl border border-line sm:h-96" />
}
