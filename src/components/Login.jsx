import { useState } from 'react'
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth'
import { auth, googleProvider } from '../firebase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleGoogle() {
    setError('')
    setBusy(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setError('Prijava nije uspjela: ' + err.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleEmailLogin(e) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      await signInWithEmailAndPassword(auth, email, password)
    } catch (err) {
      setError('Pogrešan e-mail ili lozinka.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-sm flex-col justify-center px-6">
      <p className="font-mono text-xs uppercase tracking-wider text-muted">Borivert</p>
      <h1 className="mb-6 font-display text-3xl font-bold">Prijava</h1>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={busy}
        className="mb-4 rounded-lg border border-line bg-surface px-4 py-2.5 font-medium hover:bg-surface-2 disabled:opacity-50"
      >
        Prijava s Googleom (admin)
      </button>

      <div className="mb-4 flex items-center gap-3 text-xs text-muted">
        <div className="h-px flex-1 bg-line" />
        ili e-mail i lozinka (gost)
        <div className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleEmailLogin} className="flex flex-col gap-3">
        <input
          type="email"
          required
          placeholder="e-mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2"
        />
        <input
          type="password"
          required
          placeholder="lozinka"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          Prijavi se
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-long">{error}</p>}
    </div>
  )
}
