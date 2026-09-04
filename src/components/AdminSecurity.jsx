import { useState } from 'react'
import {
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  RecaptchaVerifier,
  multiFactor,
} from 'firebase/auth'
import { auth } from '../firebase'

export default function AdminSecurity() {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [verificationId, setVerificationId] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  const enrolled = auth.currentUser ? multiFactor(auth.currentUser).enrolledFactors : []

  async function sendCode(e) {
    e.preventDefault()
    setError('')
    try {
      const verifier = new RecaptchaVerifier(auth, 'mfa-recaptcha', { size: 'invisible' })
      const session = await multiFactor(auth.currentUser).getSession()
      const provider = new PhoneAuthProvider(auth)
      const id = await provider.verifyPhoneNumber({ phoneNumber: phone, session }, verifier)
      setVerificationId(id)
      setStatus('Kod je poslan SMS-om. Upiši ga ispod.')
    } catch (err) {
      setError(
        err.code === 'auth/requires-recent-login'
          ? 'Odjavi se i ponovno prijavi, pa odmah pokušaj ovo — Firebase traži svježu prijavu za ovu radnju.'
          : 'Greška: ' + err.message,
      )
    }
  }

  async function confirmCode(e) {
    e.preventDefault()
    setError('')
    try {
      const cred = PhoneAuthProvider.credential(verificationId, code)
      const assertion = PhoneMultiFactorGenerator.assertion(cred)
      await multiFactor(auth.currentUser).enroll(assertion, 'Telefon')
      setStatus('Dvofaktorska prijava je uključena.')
      setVerificationId(null)
    } catch (err) {
      setError('Pogrešan ili istekao kod: ' + err.message)
    }
  }

  return (
    <div className="mx-auto max-w-md px-6 py-10">
      <h2 className="mb-1 font-display text-2xl font-bold">Sigurnost naloga</h2>
      <p className="mb-6 text-sm text-muted">
        Dvofaktorska prijava (SMS kod) za tvoj admin račun — traži se dodatan kod uz Google prijavu.
      </p>

      {enrolled.length > 0 ? (
        <p className="text-good">Dvofaktorska prijava je uključena ({enrolled[0].displayName || 'telefon'}).</p>
      ) : verificationId ? (
        <form onSubmit={confirmCode} className="flex flex-col gap-3">
          <input
            placeholder="SMS kod"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-lg border border-line px-3 py-2"
          />
          <button type="submit" className="rounded-lg bg-accent px-4 py-2.5 font-medium text-white">
            Potvrdi kod
          </button>
        </form>
      ) : (
        <form onSubmit={sendCode} className="flex flex-col gap-3">
          <input
            placeholder="+385 91 234 5678"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="rounded-lg border border-line px-3 py-2"
          />
          <div id="mfa-recaptcha" />
          <button type="submit" className="rounded-lg bg-accent px-4 py-2.5 font-medium text-white">
            Pošalji SMS kod
          </button>
        </form>
      )}
      {status && <p className="mt-3 text-sm text-good">{status}</p>}
      {error && <p className="mt-3 text-sm text-long">{error}</p>}
    </div>
  )
}
