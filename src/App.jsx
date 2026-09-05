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

function formatDate(value) {
  if (!value) return ''
  const d = value.toDate ? value.toDate() : new Date(value)
  return d.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function RaceCard({ race, isOwner, onEdit, onDelete }) {
  return (
    <li className="flex flex-col rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">{race.naziv}</h3>
          <p className="text-sm text-muted">{race.lokacija}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={race.statusPrijave} />
          {isOwner && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onEdit(race)}
                className="font-mono text-xs text-accent hover:underline"
                title="Uredi utrku"
              >
                uredi
              </button>
              <button
                type="button"
                onClick={() => onDelete(race.id)}
                className="font-mono text-xs text-long hover:underline"
                title="Obriši utrku"
              >
                obriši
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm text-muted">
        <span>{formatDate(race.datumPocetka)}</span>
        {race.duljinaKm ? <span>{race.duljinaKm} km</span> : null}
        {race.visinaM ? <span>{race.visinaM} m+</span> : null}
        {race.link ? (
          <a href={race.link} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            link
          </a>
        ) : null}
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
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <h1 className="font-display text-3xl font-bold">Moje utrke</h1>
        {isOwner && (
          <div className="flex gap-2">
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
