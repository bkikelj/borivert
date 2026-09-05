import { useCallback, useEffect, useMemo, useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db, functions } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { MJESEC_PUNI, toDate } from '../dateUtils'
import { IconCalendar, IconCopy } from './Icons'
import Modal from './Modal'
import RaceForm from './RaceForm'

// Adresa Cloud Functiona koji generira .ics feed (vidi functions/index.js -> calendarFeed).
const CALENDAR_FEED_URL = 'https://us-central1-borivert-9c814.cloudfunctions.net/calendarFeed'

const DANI = ['Pon', 'Uto', 'Sri', 'Čet', 'Pet', 'Sub', 'Ned']

function danaUMjesecu(godina, mjesec) {
  return new Date(godina, mjesec + 1, 0).getDate()
}

// JS Date.getDay() vraca 0=nedjelja..6=subota; nama treba 0=ponedjeljak..6=nedjelja.
function ponedjeljakOffset(godina, mjesec) {
  return (new Date(godina, mjesec, 1).getDay() + 6) % 7
}

function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export default function CalendarView() {
  const { isOwner } = useAuth()
  const [races, setRaces] = useState([])
  const [status, setStatus] = useState('ucitavanje')
  const [view, setView] = useState(() => {
    const d = new Date()
    return { godina: d.getFullYear(), mjesec: d.getMonth() }
  })
  const [editRace, setEditRace] = useState(null)

  const load = useCallback(async () => {
    setStatus('ucitavanje')
    try {
      const q = query(collection(db, 'races'), orderBy('datumPocetka', 'asc'))
      const snap = await getDocs(q)
      setRaces(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setStatus('ok')
    } catch (err) {
      console.error('Greska pri ucitavanju utrka:', err)
      setStatus('greska')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const raceByDay = useMemo(() => {
    const map = new Map()
    for (const race of races) {
      const d = toDate(race.datumPocetka)
      if (!d || d.getFullYear() !== view.godina || d.getMonth() !== view.mjesec) continue
      const key = d.getDate()
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(race)
    }
    return map
  }, [races, view])

  const dani = danaUMjesecu(view.godina, view.mjesec)
  const offset = ponedjeljakOffset(view.godina, view.mjesec)
  const celije = [...Array(offset).fill(null), ...Array.from({ length: dani }, (_, i) => i + 1)]
  const danas = new Date()

  function promijeniMjesec(delta) {
    setView(({ godina, mjesec }) => {
      const d = new Date(godina, mjesec + delta, 1)
      return { godina: d.getFullYear(), mjesec: d.getMonth() }
    })
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">Kalendar</h1>
        <div className="flex items-center gap-2 font-mono text-sm">
          <button
            type="button"
            onClick={() => promijeniMjesec(-1)}
            className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2"
            aria-label="Prethodni mjesec"
          >
            ‹
          </button>
          <span className="min-w-[9rem] text-center font-medium">
            {MJESEC_PUNI[view.mjesec]} {view.godina}
          </span>
          <button
            type="button"
            onClick={() => promijeniMjesec(1)}
            className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2"
            aria-label="Sljedeći mjesec"
          >
            ›
          </button>
          <button
            type="button"
            onClick={() => setView({ godina: danas.getFullYear(), mjesec: danas.getMonth() })}
            className="ml-1 rounded-lg border border-line px-3 py-1.5 hover:bg-surface-2"
          >
            danas
          </button>
        </div>
      </div>

      {isOwner && <CalendarShare />}

      {status === 'ucitavanje' && <p className="text-muted">Učitavanje...</p>}
      {status === 'greska' && <p className="text-long">Ne mogu učitati utrke.</p>}

      {status === 'ok' && (
        <div className="mt-6 overflow-hidden rounded-xl border border-line bg-surface">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2 font-mono text-xs uppercase text-muted">
            {DANI.map((d) => (
              <div key={d} className="px-1 py-2 text-center sm:px-2">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {celije.map((dan, i) => {
              const utrke = dan ? raceByDay.get(dan) || [] : []
              const jeDanas = dan && isSameDay(new Date(view.godina, view.mjesec, dan), danas)
              const zadnjiURedu = (i + 1) % 7 === 0
              return (
                <div
                  key={i}
                  className={`min-h-[5.5rem] border-b border-line p-1 sm:min-h-[7rem] sm:p-2 ${
                    zadnjiURedu ? '' : 'border-r'
                  } ${dan ? '' : 'bg-surface-2/40'}`}
                >
                  {dan && (
                    <>
                      <span
                        className={`inline-flex h-6 w-6 items-center justify-center rounded-full font-mono text-xs ${
                          jeDanas ? 'bg-accent text-white' : 'text-muted'
                        }`}
                      >
                        {dan}
                      </span>
                      <div className="mt-1 flex flex-col gap-1">
                        {utrke.map((race) => (
                          <button
                            key={race.id}
                            type="button"
                            onClick={() => isOwner && setEditRace(race)}
                            className="truncate rounded-md bg-accent/15 px-1.5 py-0.5 text-left font-mono text-[11px] text-accent hover:bg-accent/25"
                            title={race.naziv}
                          >
                            {race.naziv}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {editRace && (
        <Modal title="Uredi utrku" onClose={() => setEditRace(null)}>
          <RaceForm
            race={editRace}
            onSaved={() => {
              setEditRace(null)
              load()
            }}
          />
        </Modal>
      )}
    </div>
  )
}

// Panel za vlasnika: link za pretplatu na kalendar (Google/Apple/Outlook) preko
// tajnog tokena (vidi getCalendarShareLink/rotateCalendarShareLink u functions/index.js).
function CalendarShare() {
  const [link, setLink] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const load = useCallback(async (rotate) => {
    setBusy(true)
    setError('')
    try {
      const fn = httpsCallable(functions, rotate ? 'rotateCalendarShareLink' : 'getCalendarShareLink')
      const { data } = await fn()
      setLink(`${CALENDAR_FEED_URL}?token=${data.token}`)
    } catch (err) {
      setError('Greška: ' + err.message)
    } finally {
      setBusy(false)
    }
  }, [])

  useEffect(() => {
    load(false)
  }, [load])

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Ne mogu kopirati automatski — označi link i kopiraj ručno.')
    }
  }

  async function rotate() {
    if (!confirm('Stari link više neće raditi, ni ondje gdje je vec dodan u kalendar. Generirati novi?')) return
    await load(true)
  }

  return (
    <div className="mb-2 rounded-xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 font-display text-lg font-bold">
        <IconCalendar />
        Podijeli kalendar
      </div>
      <p className="mt-1 text-sm text-muted">
        Ovim se linkom netko (ili ti sam na drugom uređaju) pretplati na tvoje utrke iz Google/Apple/Outlook
        kalendara — nove i izmijenjene utrke same se pojave, bez ponovnog slanja.
      </p>
      {link && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            readOnly
            value={link}
            onFocus={(e) => e.target.select()}
            className="min-w-0 flex-1 rounded-lg border border-line bg-surface-2 px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-sm hover:bg-surface-2"
          >
            <IconCopy /> {copied ? 'kopirano!' : 'kopiraj'}
          </button>
          <a href={link.replace('https://', 'webcal://')} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-white">
            dodaj u kalendar
          </a>
        </div>
      )}
      <div className="mt-2">
        <button
          type="button"
          onClick={rotate}
          disabled={busy}
          className="font-mono text-xs text-muted hover:underline disabled:opacity-50"
        >
          generiraj novi link
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-long">{error}</p>}
    </div>
  )
}
