// Firebase inicijalizacija — koristi VITE_FIREBASE_* varijable iz .env datoteke.
// Vrijednosti dobiješ u Firebase konzoli: Project settings -> General -> Your apps -> Web app.
import { initializeApp } from 'firebase/app'
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'
import { getFunctions } from 'firebase/functions'

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Vlasnik aplikacije — jedini racun koji smije mijenjati podatke.
// (Ista vrijednost kao u functions/index.js i firestore.rules / storage.rules.)
export const OWNER_EMAIL = 'boris.kikelj@gmail.com'

export const app = initializeApp(firebaseConfig)

// App Check — odbija pozive prema Firestore/Auth/Storage koji ne dolaze iz ove
// aplikacije (npr. skripta koja pogodi tvoju javnu Firebase konfiguraciju).
// Radi tek nakon sto u Firebase konzoli (Build -> App Check) registrirasi web app
// i upises VITE_RECAPTCHA_SITE_KEY u .env — do tada se jednostavno preskace.
if (import.meta.env.VITE_RECAPTCHA_SITE_KEY) {
  initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider(import.meta.env.VITE_RECAPTCHA_SITE_KEY),
    isTokenAutoRefreshEnabled: true,
  })
}

export const auth = getAuth(app)
export const googleProvider = new GoogleAuthProvider()
export const db = getFirestore(app)
export const storage = getStorage(app)
export const functions = getFunctions(app)
