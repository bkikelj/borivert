import { useCallback, useEffect, useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import { collection, deleteDoc, doc, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from './firebase'
import { AuthProvider, useAuth } from './context/AuthContext'
import Login from './components/Login'
import AdminUsers from './components/AdminUsers'
import AdminSecurity from './components/AdminSecurity'
import AddRaceForm from './components/AddRaceForm'
import StatusPill from './components/StatusPill'

function formatDate(value) {
  if (!value) return ''
  const d = value.toDate ? value.toDate() : new Date(value)
  return d.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function RaceCard({ race, isOwner, onDelete }) {
  return (
    <li className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">{race.naziv}</h3>
          <p className="text-sm text-muted">{race.lokacija}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={race.statusPrijave} />
          {isOwner && (
            <button
              type="button"
              onClick={() => onDelete(race.id)}
              className="font-mono text-xs text-long hover:underline"
              title="Obriši utrku"
            >
              obriši
            </button>
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
  const { isOwner, logout } = useAuth()
  const [races, setRaces] = useState([])
  const [status, setStatus] = useState('ucitavanje')

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
    <div className="mx-auto min-h-svh max-w-2xl px-6 py-10">
      <header className="mb-8 flex items-start justify-between border-b border-line pb-6">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted">Borivert</p>
          <h1 className="font-display text-4xl font-bold">Moje utrke</h1>
        </div>
        <div className="flex flex-col items-end gap-2 font-mono text-xs">
          {isOwner && (
            <div className="flex gap-3">
              <Link to="/admin/korisnici" className="text-accent hover:underline">
                korisnici
              </Link>
              <Link to="/admin/sigurnost" className="text-accent hover:underline">
                sigurnost
              </Link>
            </div>
          )}
          <button type="button" onClick={logout} className="text-muted hover:underline">
            odjava
          </button>
        </div>
      </header>

      {isOwner && <AddRaceForm onAdded={load} />}

      {status === 'ucitavanje' && <p className="text-muted">Učitavanje...</p>}
      {status === 'greska' && (
        <p className="text-long">
          Ne mogu učitati utrke. Provjeri je li <code>.env</code> popunjen i jesu li Firestore
          sigurnosna pravila objavljena (vidi <code>firestore.rules</code>).
        </p>
      )}
      {status === 'ok' && races.length === 0 && <p className="text-muted">Još nema unesenih utrka.</p>}
      {status === 'ok' && races.length > 0 && (
        <ul className="flex flex-col gap-3">
          {races.map((race) => (
            <RaceCard key={race.id} race={race} isOwner={isOwner} onDelete={handleDelete} />
          ))}
        </ul>
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
    <Routes>
      <Route path="/" element={<RaceList />} />
      <Route path="/admin/korisnici" element={<AdminUsers />} />
      <Route path="/admin/sigurnost" element={<AdminSecurity />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
