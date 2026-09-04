import { useState } from 'react'
import { createViewerAccount } from '../adminActions'

function generatePassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export default function AdminUsers() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(generatePassword())
  const [status, setStatus] = useState(null) // null | 'busy' | 'ok' | 'greska'
  const [message, setMessage] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setStatus('busy')
    try {
      await createViewerAccount(email, password)
      setStatus('ok')
      setMessage(`Korisnik ${email} je kreiran. Proslijedi mu e-mail i lozinku (${password}) — može se prijaviti odmah.`)
      setEmail('')
      setPassword(generatePassword())
    } catch (err) {
      setStatus('greska')
      setMessage(err.code === 'auth/email-already-in-use' ? 'Taj e-mail već ima nalog.' : 'Greška: ' + err.message)
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h2 className="mb-1 font-display text-2xl font-bold">Gostujući korisnici</h2>
      <p className="mb-6 text-sm text-muted">
        Kreiraj nalog (e-mail + lozinka) za nekoga tko smije samo gledati tvoje utrke, bez uređivanja.
      </p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="e-mail gosta"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2"
        />
        <div className="flex gap-2">
          <input
            type="text"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="flex-1 rounded-lg border border-line bg-surface px-3 py-2 font-mono"
          />
          <button
            type="button"
            onClick={() => setPassword(generatePassword())}
            className="rounded-lg border border-line px-3 py-2 text-sm"
          >
            nova
          </button>
        </div>
        <button
          type="submit"
          disabled={status === 'busy'}
          className="rounded-lg bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          Kreiraj korisnika
        </button>
      </form>
      {message && (
        <p className={`mt-4 text-sm ${status === 'greska' ? 'text-long' : 'text-good'}`}>{message}</p>
      )}
    </div>
  )
}
