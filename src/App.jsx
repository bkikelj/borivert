import { useEffect, useState } from 'react'
import { collection, getDocs, orderBy, query } from 'firebase/firestore'
import { db } from './firebase'
import StatusPill from './components/StatusPill'

function formatDate(value) {
  if (!value) return ''
  const d = value.toDate ? value.toDate() : new Date(value)
  return d.toLocaleDateString('hr-HR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function RaceCard({ race }) {
  return (
    <li className="rounded-xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold">{race.naziv}</h3>
          <p className="text-sm text-muted">{race.lokacija}</p>
        </div>
        <StatusPill status={race.statusPrijave} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-sm text-muted">
        <span>{formatDate(race.datumPocetka)}</span>
        {race.duljinaKm ? <span>{race.duljinaKm} km</span> : null}
        {race.visinaM ? <span>{race.visinaM} m+</span> : null}
      </div>
    </li>
  )
}

export default function App() {
  const [races, setRaces] = useState([])
  const [status, setStatus] = useState('ucitavanje') // ucitavanje | ok | greska

  useEffect(() => {
    async function load() {
      try {
        const q = query(collection(db, 'races'), orderBy('datumPocetka', 'asc'))
        const snap = await getDocs(q)
        setRaces(snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })))
        setStatus('ok')
      } catch (err) {
        console.error('Greska pri ucitavanju utrka:', err)
        setStatus('greska')
      }
    }
    load()
  }, [])

  return (
    <div className="mx-auto min-h-svh max-w-2xl px-6 py-10">
      <header className="mb-8 border-b border-line pb-6">
        <p className="font-mono text-xs uppercase tracking-wider text-muted">Borivert</p>
        <h1 className="font-display text-4xl font-bold">Moje utrke</h1>
      </header>

      {status === 'ucitavanje' && <p className="text-muted">Učitavanje...</p>}
      {status === 'greska' && (
        <p className="text-long">
          Ne mogu učitati utrke. Provjeri je li <code>.env</code> popunjen i jesu li Firestore
          sigurnosna pravila postavljena (vidi <code>firestore.rules</code>).
        </p>
      )}
      {status === 'ok' && races.length === 0 && (
        <p className="text-muted">Još nema unesenih utrka.</p>
      )}
      {status === 'ok' && races.length > 0 && (
        <ul className="flex flex-col gap-3">
          {races.map((race) => (
            <RaceCard key={race.id} race={race} />
          ))}
        </ul>
      )}
    </div>
  )
}
