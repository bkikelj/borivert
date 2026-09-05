import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { collection, doc, getDoc, getDocs, orderBy, query, updateDoc } from 'firebase/firestore'
import { deleteObject, getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { db, storage } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { formatDate, toDate } from '../dateUtils'
import { computeTrackStats, parseGpx } from '../gpx'
import { dohvatiProgozu, geocodeMjesto, opisVremena } from '../weather'
import { formatTrajanje, procijeniTrajanjeMin } from '../pace'
import { analizirajRazmakSvihUtrka } from '../opterecenje'
import StatusPill from './StatusPill'
import RaceMap from './RaceMap'
import ElevationChart from './ElevationChart'
import { IconBack, IconElevation, IconLink, IconMap, IconPin, IconRoute, IconTrash, IconUpload, IconWarning } from './Icons'

export default function RaceDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { isOwner } = useAuth()
  const [race, setRace] = useState(null)
  const [razmak, setRazmak] = useState(null)
  const [status, setStatus] = useState('ucitavanje')
  const [track, setTrack] = useState(null) // { distanceKm, gainM, lossM, minEle, maxEle, points }
  const [trackStatus, setTrackStatus] = useState('prazno') // prazno | ucitavanje | ok | greska
  const [trackError, setTrackError] = useState('')
  const [uploading, setUploading] = useState(false)

  const load = useCallback(async () => {
    setStatus('ucitavanje')
    try {
      const snap = await getDoc(doc(db, 'races', id))
      if (!snap.exists()) {
        setStatus('nepostojeca')
        return
      }
      setRace({ id: snap.id, ...snap.data() })
      setStatus('ok')

      // Za upozorenje o razmaku trebaju nam i susjedne utrke - laki dodatni upit.
      try {
        const svesnap = await getDocs(query(collection(db, 'races'), orderBy('datumPocetka', 'asc')))
        const sve = svesnap.docs.map((d) => ({ id: d.id, ...d.data() }))
        setRazmak(analizirajRazmakSvihUtrka(sve).get(id) || null)
      } catch (err) {
        console.error('Greska pri racunanju razmaka izmedju utrka:', err)
      }
    } catch (err) {
      console.error('Greska pri ucitavanju utrke:', err)
      setStatus('greska')
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!race?.gpxUrl) {
      setTrack(null)
      setTrackStatus('prazno')
      return
    }
    let otkazano = false
    setTrackStatus('ucitavanje')
    setTrackError('')
    fetch(race.gpxUrl)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.text()
      })
      .then((xml) => {
        if (otkazano) return
        const points = parseGpx(xml)
        setTrack(computeTrackStats(points))
        setTrackStatus('ok')
      })
      .catch((err) => {
        if (otkazano) return
        setTrackError('Ne mogu učitati GPX: ' + err.message)
        setTrackStatus('greska')
      })
    return () => {
      otkazano = true
    }
  }, [race?.gpxUrl])

  const procijenjenoTrajanje = useMemo(() => {
    if (!race) return null
    return formatTrajanje(procijeniTrajanjeMin(race.tip, race.duljinaKm, race.visinaM))
  }, [race])

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const text = await file.text()
      parseGpx(text) // provjera da je file zaista valjan GPX prije uploada
      const storageRef = ref(storage, `gpx/${race.id}.gpx`)
      await uploadBytes(storageRef, file, { contentType: 'application/gpx+xml' })
      const url = await getDownloadURL(storageRef)
      await updateDoc(doc(db, 'races', race.id), { gpxUrl: url })
      setRace((r) => ({ ...r, gpxUrl: url }))
    } catch (err) {
      alert('Ne mogu učitati GPX: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  async function handleRemoveGpx() {
    if (!confirm('Ukloniti GPX stazu s ove utrke?')) return
    try {
      await deleteObject(ref(storage, `gpx/${race.id}.gpx`)).catch(() => {})
      await updateDoc(doc(db, 'races', race.id), { gpxUrl: null })
      setRace((r) => ({ ...r, gpxUrl: null }))
    } catch (err) {
      alert('Greška: ' + err.message)
    }
  }

  if (status === 'ucitavanje') {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-muted sm:px-6">Učitavanje...</p>
  }
  if (status === 'nepostojeca') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-muted">Ova utrka ne postoji (možda je obrisana).</p>
        <Link to="/" className="mt-3 inline-flex items-center gap-1 text-accent hover:underline">
          <IconBack /> natrag na popis
        </Link>
      </div>
    )
  }
  if (status === 'greska') {
    return <p className="mx-auto max-w-3xl px-4 py-10 text-long sm:px-6">Ne mogu učitati utrku.</p>
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-6 inline-flex items-center gap-1 font-mono text-sm text-muted hover:text-ink"
      >
        <IconBack /> natrag
      </button>

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="break-words font-display text-3xl font-bold">{race.naziv}</h1>
          {race.lokacija && (
            <p className="mt-1 flex items-center gap-1 text-muted">
              <IconPin className="flex-none" />
              {race.lokacija}
            </p>
          )}
        </div>
        <StatusPill status={race.statusPrijave} />
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 font-mono text-sm text-muted">
        <span>{formatDate(race.datumPocetka)}</span>
        {race.vrijemePocetka && <span>{race.vrijemePocetka}</span>}
        {race.duljinaKm ? (
          <span className="inline-flex items-center gap-1">
            <IconRoute />
            {race.duljinaKm} km
          </span>
        ) : null}
        {race.visinaM ? (
          <span className="inline-flex items-center gap-1">
            <IconElevation />
            {race.visinaM} m+
          </span>
        ) : null}
        {procijenjenoTrajanje && (
          <span className="inline-flex items-center gap-1" title="Procjena temeljem tvog dosadašnjeg tempa">
            ~{procijenjenoTrajanje}
          </span>
        )}
      </div>

      {razmak && (
        <p className="mt-3 flex items-start gap-2 text-sm text-warn">
          <IconWarning className="mt-0.5 flex-none" />
          Razmak {razmak.smjer === 'prije' ? 'od' : 'do'} "{razmak.susjed.naziv}" je {razmak.gapDana} dana, preporučeno
          je barem {razmak.potrebnoDana}
          {razmak.lagan ? ' (tretirano kao lagan napor)' : ''}.
        </p>
      )}

      {(race.link || race.lokacijaLink) && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {race.link && (
            <a href={race.link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
              <IconLink /> stranica utrke
            </a>
          )}
          {race.lokacijaLink && (
            <a href={race.lokacijaLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
              <IconMap /> lokacija na karti
            </a>
          )}
        </div>
      )}

      {/* --- GPX staza --- */}
      <section className="mt-8 border-t border-line pt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold">Staza</h2>
          {isOwner && (
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-line px-3 py-1.5 text-sm hover:bg-surface-2">
                <IconUpload />
                {uploading ? 'Učitavam...' : race.gpxUrl ? 'Zamijeni GPX' : 'Dodaj GPX'}
                <input type="file" accept=".gpx" onChange={handleUpload} disabled={uploading} className="hidden" />
              </label>
              {race.gpxUrl && (
                <button type="button" onClick={handleRemoveGpx} className="inline-flex items-center gap-1 font-mono text-xs text-long hover:underline">
                  <IconTrash /> makni
                </button>
              )}
            </div>
          )}
        </div>

        {!race.gpxUrl && <p className="text-sm text-muted">Za ovu utrku još nema uvezene GPX staze.</p>}
        {trackStatus === 'ucitavanje' && <p className="text-sm text-muted">Učitavam stazu...</p>}
        {trackStatus === 'greska' && <p className="text-sm text-long">{trackError}</p>}
        {trackStatus === 'ok' && track && (
          <div className="flex flex-col gap-4">
            <RaceMap points={track.points} />
            <ElevationChart points={track.points} />
            <div className="flex flex-wrap gap-x-5 gap-y-1 font-mono text-sm text-muted">
              <span>staza: {track.distanceKm} km</span>
              <span>uspon: {track.gainM} m+</span>
              <span>spust: {track.lossM} m-</span>
              {track.minEle != null && <span>{track.minEle}–{track.maxEle} m n.v.</span>}
            </div>
          </div>
        )}
      </section>

      {/* --- Vremenska prognoza --- */}
      <WeatherSection race={race} />
    </div>
  )
}

function WeatherSection({ race }) {
  const [stanje, setStanje] = useState('cekanje') // cekanje | predaleko | proslo | ucitavanje | ok | greska | nema-lokaciju
  const [prognoza, setPrognoza] = useState(null)
  const [mjesto, setMjesto] = useState(null)
  const [greska, setGreska] = useState('')

  useEffect(() => {
    const datum = toDate(race.datumPocetka)
    if (!datum) return
    const danas = new Date()
    danas.setHours(0, 0, 0, 0)
    const dana = Math.round((datum - danas) / 86400000)

    if (dana < 0) {
      setStanje('proslo')
      return
    }
    if (dana > 15) {
      setStanje('predaleko')
      return
    }
    if (!race.lokacija) {
      setStanje('nema-lokaciju')
      return
    }

    let otkazano = false
    setStanje('ucitavanje')
    ;(async () => {
      try {
        const loc = await geocodeMjesto(race.lokacija)
        if (!loc) {
          if (!otkazano) setStanje('nema-lokaciju')
          return
        }
        const iso = datum.toISOString().slice(0, 10)
        const p = await dohvatiProgozu(loc.lat, loc.lon, iso)
        if (otkazano) return
        if (!p) {
          setStanje('greska')
          setGreska('Prognoza za taj datum još nije dostupna.')
          return
        }
        setMjesto(loc)
        setPrognoza(p)
        setStanje('ok')
      } catch (err) {
        if (!otkazano) {
          setStanje('greska')
          setGreska(err.message)
        }
      }
    })()
    return () => {
      otkazano = true
    }
  }, [race.lokacija, race.datumPocetka])

  return (
    <section className="mt-8 border-t border-line pt-6">
      <h2 className="mb-3 font-display text-xl font-bold">Vremenska prognoza</h2>
      {stanje === 'proslo' && <p className="text-sm text-muted">Utrka je već prošla.</p>}
      {stanje === 'predaleko' && (
        <p className="text-sm text-muted">Prognoza je dostupna tek otprilike 15 dana prije utrke — vrati se bliže datumu.</p>
      )}
      {stanje === 'nema-lokaciju' && (
        <p className="text-sm text-muted">Za prognozu nedostaje prepoznatljiva lokacija (upiši mjesto u polju "Lokacija").</p>
      )}
      {stanje === 'ucitavanje' && <p className="text-sm text-muted">Dohvaćam prognozu...</p>}
      {stanje === 'greska' && <p className="text-sm text-long">{greska}</p>}
      {stanje === 'ok' && prognoza && (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
          <div>
            <p className="font-mono text-2xl font-bold">
              {prognoza.tMin}° / {prognoza.tMax}°
            </p>
            <p className="text-sm capitalize text-muted">{opisVremena(prognoza.code)}</p>
          </div>
          <div className="font-mono text-sm text-muted">
            <p>oborine: {prognoza.oborine}%</p>
            <p>vjetar: do {prognoza.vjetar} km/h</p>
          </div>
          {mjesto && <p className="font-mono text-xs text-muted">({mjesto.naziv})</p>}
        </div>
      )}
    </section>
  )
}
