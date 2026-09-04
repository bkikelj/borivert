// Kreiranje gostujuceg (view-only) korisnika iz admin panela, bez odjave admina.
// Trik: kreiramo PRIVREMENU, drugu Firebase app instancu samo za tu jednu radnju —
// tako se admin ne izbaci iz svoje prijave (createUserWithEmailAndPassword inace
// automatski prijavljuje novog korisnika na klijentu na kojem se pozove).
import { deleteApp, initializeApp } from 'firebase/app'
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth'
import { firebaseConfig } from './firebase'

export async function createViewerAccount(email, password) {
  const secondaryApp = initializeApp(firebaseConfig, `admin-create-${Date.now()}`)
  const secondaryAuth = getAuth(secondaryApp)
  try {
    await createUserWithEmailAndPassword(secondaryAuth, email, password)
    await signOut(secondaryAuth)
  } finally {
    await deleteApp(secondaryApp)
  }
}
