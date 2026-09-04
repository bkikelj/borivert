import { useState } from 'react'
import { addDoc, collection, Timestamp } from 'firebase/firestore'
import { db } from '../firebase'

const initial = {
  naziv: '',
  lokacija: '',
  datum: '',
  vrijeme: '',
  duljinaKm: '',
  visinaM: '',
  statusPrijave: 'planirano',
  link: '',
}

export default function AddRaceForm({ onAdded }) {
  const [form, setForm] = useState(initial)
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
      await addDoc(collection(db, 'races'), {
        naziv: form.naziv,
        tip: 'trail',
        lokacija: form.lokacija || null,
        datumPocetka: Timestamp.fromDate(new Date(`${form.datum}T${form.vrijeme || '09:00'}:00`)),
        vrijemePocetka: form.vrijeme || null,
        duljinaKm: form.duljinaKm ? Number(form.duljinaKm) : null,
        visinaM: form.visinaM ? Number(form.visinaM) : null,
        dugaUtrka: false,
        statusPrijave: form.statusPrijave,
        startninaPlacena: false,
        link: form.link || null,
        napomene: null,
      })
      setForm(initial)
      onAdded?.()
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
        Spremi utrku
      </button>
    </form>
  )
}
