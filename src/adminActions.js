// Kreiranje gostujuceg (view-only) korisnika iz admin panela.
// Poziva se preko Cloud Functiona (functions/index.js -> createViewerAccount),
// koji koristi Admin SDK — pa admin ostaje prijavljen, i racun prolazi mimo
// beforeCreate blokirajuce funkcije (vidi komentar u functions/index.js).
import { getFunctions, httpsCallable } from 'firebase/functions'
import { app } from './firebase'

const functions = getFunctions(app)

export async function createViewerAccount(email, password) {
  const call = httpsCallable(functions, 'createViewerAccount')
  const { data } = await call({ email, password })
  return data
}
