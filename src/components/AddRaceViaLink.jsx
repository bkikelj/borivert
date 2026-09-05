import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '../firebase'
import RaceForm from './RaceForm'

// Korak 1: admin zalijepi link -> povucemo naslov/opis/eventualni datum sa
// stranice preko Cloud Functiona (izbjegava CORS). Korak 2: prikazemo istu
// formu kao za rucni unos, ali vec popunjenu onim sto smo uspjeli pronaci.
export default function AddRaceViaLink({ onSaved }) {
  const [url, setUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [initial, setInitial] = useState(null)

  async function handleFetch(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const call = httpsCallable(functions, 'fetchLinkPreview')
      const { data } = await call({ url })
      setInitial({
        naziv: data.event?.naziv || data.title || '',
        link: data.url || url,
        lokacija: data.event?.lokacija || '',
        datum: data.event?.datum ? String(data.event.datum).slice(0, 10) : '',
      })
    } catch (err) {
      setError('Ne mogu dohvatiti podatke s linka: ' + (err.message || err))
    } finally {
      setBusy(false)
    }
  }

  if (initial) {
    return <RaceForm initial={initial} onSaved={onSaved} />
  }

  return (
    <form onSubmit={handleFetch} className="flex flex-col gap-3">
      <p className="text-sm text-muted">
        Zalijepi link na najavu utrke (stranica organizatora, Instagram/Facebook objava...).
        Pokušat ćemo sami povući naziv i eventualno datum — ostalo doradiš u sljedećem koraku.
      </p>
      <input
        type="url"
        placeholder="https://..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        required
        className="rounded-lg border border-line px-3 py-2"
      />
      {error && <p className="text-sm text-long">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-lg bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-50"
      >
        {busy ? 'Dohvaćam...' : 'Povuci podatke'}
      </button>
      <button
        type="button"
        onClick={() => setInitial({ link: url })}
        className="font-mono text-xs text-muted hover:underline"
      >
        Preskoči i upiši ručno
      </button>
    </form>
  )
}
