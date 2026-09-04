import { useState } from 'react'
import { addDoc, collection, doc, Timestamp, updateDoc } from 'firebase/firestore'
import { db } from '../firebase'

const empty = {
  naziv: '',
  lokacija: '',
  datum: '',
  vrijeme: '',
  duljinaKm: '',
  visinaM: '',
  statusPrijave: 'planirano',
  link: '',
}

function toDateInputValue(date) {
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function toFormState(race) {
  if (!race) return empty
  const d = race.datumPocetka?.toDate ? race.datumPocetka.toDate() : null
  return {
    naziv: race.naziv || '',
    lokacija: race.lokacija || '',
    datum: d ? toDateInputValue(d) : '',
    vrijeme: race.vrijemePocetka || '',
    duljinaKm: race.duljinaKm ?? '',
    visinaM: race.visinaM ?? '',
    statusPrijave: race.statusPrijave || 'planirano',
    link: race.link || '',
  }
}

// race = null -> dodavanje nove utrke; race = { id, ...podaci } -> uredivanje postojece
export default function RaceForm({ race, onSaved }) {
  const [form, setForm] = useState(() => toFormState(race))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!form.naziv || !form.datum) {
      setError('Naziv i datum su obavezni.')
      return
    }
    setBusy(true)
    try {
      const payload = {
        naziv: form.naziv,
        tip: 'trail',
        lokacija: form.lokacija || null,
        datumPocetka: Timestamp.fromDate(new Date(`${form.datum}T${form.vrijeme || '09:00'}:00`)),
        vrijemePocetka: form.vrijeme || null,
        duljinaKm: form.duljinaKm ? Number(form.duljinaKm) : null,
        visinaM: form.visinaM ? Number(form.visinaM) : null,
        dugaUtrka: false,
        statusPrijave: form.statusPrijave,
        startninaPlacena: race?.startninaPlacena ?? false,
        link: form.link || null,
        napomene: race?.napomene ?? null,
      }
      if (race?.id) {
        await updateDoc(doc(db, 'races', race.id), payload)
      } else {
        await addDoc(collection(db, 'races'), payload)
      }
      setForm(empty)
      onSaved?.()
    } catch (err) {
      setError('Greška pri spremanju: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <input placeholder="Naziv utrke" value={form.naziv} onChange={set('naziv')} className="rounded-lg border border-line px-3 py-2" />
      <input placeholder="Lokacija" value={form.lokacija} onChange={set('lokacija')} className="rounded-lg border border-line px-3 py-2" />
      <div className="flex gap-2">
        <input type="date" value={form.datum} onChange={set('datum')} className="flex-1 rounded-lg border border-line px-3 py-2" />
        <input type="time" value={form.vrijeme} onChange={set('vrijeme')} className="w-28 rounded-lg border border-line px-3 py-2" />
      </div>
      <div className="flex gap-2">
        <input type="number" step="0.1" placeholder="km" value={form.duljinaKm} onChange={set('duljinaKm')} className="flex-1 rounded-lg border border-line px-3 py-2" />
        <input type="number" placeholder="m+" value={form.visinaM} onChange={set('visinaM')} className="flex-1 rounded-lg border border-line px-3 py-2" />
      </div>
      <select value={form.statusPrijave} onChange={set('statusPrijave')} className="rounded-lg border border-line px-3 py-2">
        <option value="planirano">planirano</option>
        <option value="prijavljeno">prijavljeno</option>
        <option value="mozda">možda</option>
        <option value="otrcano">otrčano</option>
        <option value="otkazano">otkazano</option>
      </select>
      <input placeholder="Link (nije obavezno)" value={form.link} onChange={set('link')} className="rounded-lg border border-line px-3 py-2" />
      {error && <p className="text-sm text-long">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-50">
        {race ? 'Spremi izmjene' : 'Spremi utrku'}
      </button>
    </form>
  )
}
