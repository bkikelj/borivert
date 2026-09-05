import { useCallback, useEffect, useState } from 'react'
import { Route, Routes } from 'react-router-dom'
import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from './firebase'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './components/Login'
import NavBar from './components/NavBar'
import AdminUsers from './components/AdminUsers'
import AdminSecurity from './components/AdminSecurity'
import RaceForm from './components/RaceForm'
import AddRaceViaLink from './components/AddRaceViaLink'
import Modal from './components/Modal'
import StatusPill from './components/StatusPill'
import CalendarView from './components/CalendarView'
import { IconElevation, IconLink, IconMap, IconPin, IconRoute } from './components/Icons'
import { formatDateParts } from './dateUtils'

function RaceCard({ race, isOwner, onEdit, onDelete }) {
  const datum = formatDateParts(race.datumPocetka)
  return (
    <li className="flex overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex w-16 flex-none flex-col items-center justify-center gap-0.5 border-r border-line bg-surface-2 py-3 font-mono">
        {datum ? (
          <>
            <span className="text-[11px] font-semibold tracking-wide text-muted">{datum.mjesec}</span>
            <span className="text-2xl font-bold leading-none">{datum.dan}</span>
            <span className="text-[11px] text-muted">{datum.godina}</span>
          </>
        ) : (
          <span className="text-xs text-muted">—</span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="break-words font-display text-lg font-bold">{race.naziv}</h3>
            {race.lokacija && (
              <p className="mt-0.5 flex items-center gap-1 break-words text-sm text-muted">
                <IconPin className="flex-none" />
                {race.lokacija}
              </p>
            )}
          </div>
          <StatusPill status={race.statusPrijave} />
        </div>

        {(race.vrijemePocetka || race.duljinaKm || race.visinaM) && (
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm text-muted">
            {race.vrijemePocetka ? <span>{race.vrijemePocetka}</span> : null}
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
          </div>
        )}

        {(race.link || race.lokacijaLink) && (
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {race.link ? (
              <a
                href={race.link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <IconLink /> link
              </a>
            ) : null}
            {race.lokacijaLink ? (
              <a
                href={race.lokacijaLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-accent hover:underline"
              >
                <IconMap /> mapa
              </a>
            ) : null}
          </div>
        )}

        {isOwner && (
          <div className="mt-auto flex justify-end gap-3 pt-3 font-mono text-xs">
            <button type="button" onClick={() => onEdit(race)} className="text-accent hover:underline" title="Uredi utrku">
              uredi
            </button>
            <button
              type="button"
              onClick={() => onDelete(race.id)}
              className="text-long hover:underline"
              title="Obriši utrku"
            >
              obriši
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

function RaceList() {
  const { isOwner } = useAuth()
  const [races, setRaces] = useState([])
  const [status, setStatus] = useState('ucitavanje')
  const [formTarget, setFormTarget] = useState(null) // null = zatvoreno, 'new' = dodavanje, objekt = uredivanje

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

  async function handleDelete(id) {
    if (!confirm('Obrisati ovu utrku?')) return
    await deleteDoc(doc(db, 'races', id))
    load()
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">Moje utrke</h1>
        {isOwner && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFormTarget('link')}
              className="whitespace-nowrap rounded-lg border border-line bg-surface px-4 py-2.5 font-medium text-ink"
            >
              + Putem linka
            </button>
            <button
              type="button"
              onClick={() => setFormTarget('new')}
              className="whitespace-nowrap rounded-lg bg-accent px-4 py-2.5 font-medium text-white"
            >
              + Dodaj utrku
            </button>
          </div>
        )}
      </div>

      {status === 'ucitavanje' && <p className="text-muted">Učitavanje...</p>}
      {status === 'greska' && (
        <p className="text-long">
          Ne mogu učitati utrke. Provjeri je li <code>.env</code> popunjen i jesu li Firestore
          sigurnosna pravila objavljena (vidi <code>firestore.rules</code>).
        </p>
      )}
      {status === 'ok' && races.length === 0 && <p className="text-muted">Još nema unesenih utrka.</p>}
      {status === 'ok' && races.length > 0 && (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {races.map((race) => (
            <RaceCard key={race.id} race={race} isOwner={isOwner} onEdit={setFormTarget} onDelete={handleDelete} />
          ))}
        </ul>
      )}

      {formTarget && (
        <Modal
          title={
            formTarget === 'new' ? 'Dodaj utrku' : formTarget === 'link' ? 'Dodaj putem linka' : 'Uredi utrku'
          }
          onClose={() => setFormTarget(null)}
        >
          {formTarget === 'link' ? (
            <AddRaceViaLink
              onSaved={() => {
                setFormTarget(null)
                load()
              }}
            />
          ) : (
            <RaceForm
              race={formTarget === 'new' ? null : formTarget}
              onSaved={() => {
                setFormTarget(null)
                load()
              }}
            />
          )}
        </Modal>
      )}
    </div>
  )
}

function Gate() {
  const { user, loading } = useAuth()
  if (loading) {
    return <p className="p-10 text-center text-muted">Učitavanje...</p>
  }
  if (!user) {
    return <Login />
  }
  return (
    <div className="min-h-svh bg-bg">
      <NavBar />
      <Routes>
        <Route path="/" element={<RaceList />} />
        <Route path="/kalendar" element={<CalendarView />} />
        <Route path="/admin/korisnici" element={<AdminUsers />} />
        <Route path="/admin/sigurnost" element={<AdminSecurity />} />
      </Routes>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
