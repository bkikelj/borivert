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

/**
 * Callable funkcija za "Dodaj utrku putem linka". Admin zalijepi link na
 * najavu utrke (bilo koja stranica, Instagram/Facebook objava, kalendar
 * organizatora...), a ovdje na serveru dohvatimo tu stranicu (izbjegavamo
 * CORS koji bi blokirao izravan fetch iz browsera) i pokusamo izvuci osnovne
 * podatke: naslov, opis, i - ako stranica ima ugradene schema.org Event
 * podatke (JSON-LD) - i naziv/datum/lokaciju dogadaja. Sve ostalo admin
 * dopunjava rucno u formi koja se otvara odmah nakon ovoga.
 */
exports.fetchLinkPreview = onCall(async (request) => {
  if (request.auth?.token?.email !== OWNER_EMAIL) {
    throw new HttpsError('permission-denied', 'Samo administrator smije koristiti ovu funkciju.')
  }
  const rawUrl = String(request.data?.url || '').trim()
  let target
  try {
    target = new URL(rawUrl)
  } catch {
    throw new HttpsError('invalid-argument', 'Nevažeći link.')
  }
  if (!['http:', 'https:'].includes(target.protocol)) {
    throw new HttpsError('invalid-argument', 'Link mora biti http/https.')
  }
  const host = target.hostname.toLowerCase()
  const isPrivateHost =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host.startsWith('10.') ||
    host.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host) ||
    host.endsWith('.local')
  if (isPrivateHost) {
    throw new HttpsError('invalid-argument', 'Ovaj link nije dopušten.')
  }

  let html
  try {
    const res = await fetch(target.toString(), {
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; BorivertBot/1.0; +https://bkikelj.github.io/borivert/)',
        Accept: 'text/html',
      },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    html = (await res.text()).slice(0, 500000) // sigurnosni limit velicine
  } catch (err) {
    throw new HttpsError('unavailable', 'Ne mogu dohvatiti tu stranicu: ' + err.message)
  }

  function decodeEntities(s) {
    return s
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
  }
  function meta(prop) {
    const re = new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,
      'i',
    )
    const m = html.match(re)
    return m ? decodeEntities(m[1]).trim() : null
  }

  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
  const title = meta('og:title') || (titleMatch ? decodeEntities(titleMatch[1]).trim() : null)
  const description = meta('og:description') || meta('description')
  const image = meta('og:image')

  // Pokusaj naci schema.org Event podatke (JSON-LD) - neke stranice s najavama
  // dogadaja to imaju ugradeno, pa dobijemo tocan datum/lokaciju bez pogadanja.
  let event = null
  const ldBlocks = [
    ...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi),
  ]
  for (const block of ldBlocks) {
    let data
    try {
      data = JSON.parse(block[1])
    } catch {
      continue
    }
    const items = Array.isArray(data) ? data : [data]
    for (const item of items) {
      const type = item['@type']
      const isEvent = type === 'Event' || (Array.isArray(type) && type.includes('Event'))
      if (isEvent) {
        event = {
          naziv: item.name || null,
          datum: item.startDate || null,
          lokacija:
            item.location?.name ||
            item.location?.address?.addressLocality ||
            (typeof item.location?.address === 'string' ? item.location.address : null) ||
            null,
        }
        break
      }
    }
    if (event) break
  }

  return { title, description, image, event, url: target.toString() }
})
