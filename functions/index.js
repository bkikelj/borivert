const { onCall, HttpsError } = require('firebase-functions/v2/https')
const { beforeUserCreated } = require('firebase-functions/v2/identity')
const admin = require('firebase-admin')

admin.initializeApp()

// Vlasnik aplikacije — jedini koji smije kreirati goste i pisati podatke.
// (Ista vrijednost kao u src/firebase.js i firestore.rules — drzi ih usklađenima.)
const OWNER_EMAIL = 'boris.kikelj@gmail.com'

/**
 * Blokira SVAKU samoprijavu koja prolazi kroz klijentski Firebase Auth SDK —
 * izravan poziv na Auth API, tuđi Google račun koji pokuša prijavu na ovu app, itd.
 * Racuni koje admin kreira preko Admin SDK-a (createViewerAccount ispod) NE prolaze
 * kroz ovaj trigger — Admin SDK je vec povjerljiv, pouzdan put, pa ga Firebase
 * namjerno ne provjerava ovdje. Zato ovo pravilo moze biti strogo.
 */
exports.beforeCreate = beforeUserCreated((event) => {
  const email = event.data.email
  if (email === OWNER_EMAIL) return // tvoja prva Google prijava
  throw new HttpsError(
    'permission-denied',
    'Registracija nije dopuštena. Nalog kreira administrator u admin panelu.',
  )
})

/**
 * Callable funkcija koju zove admin panel (src/adminActions.js) da kreira
 * gostujuci (view-only) nalog. Provjerava da poziv stize od vlasnika, pa tek
 * onda kreira korisnika preko Admin SDK-a (server-side, bez utjecaja na
 * admin-ovu vlastitu prijavljenu sesiju).
 */
exports.createViewerAccount = onCall(async (request) => {
  if (request.auth?.token?.email !== OWNER_EMAIL) {
    throw new HttpsError('permission-denied', 'Samo administrator smije kreirati korisnike.')
  }
  const email = String(request.data?.email || '').trim()
  const password = String(request.data?.password || '')
  if (!email || password.length < 8) {
    throw new HttpsError('invalid-argument', 'Treba e-mail i lozinka od barem 8 znakova.')
  }

  const user = await admin.auth().createUser({ email, password })
  await admin.auth().setCustomUserClaims(user.uid, { role: 'viewer' })
  return { uid: user.uid }
})
