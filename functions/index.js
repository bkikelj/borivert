const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https')
const { beforeUserCreated } = require('firebase-functions/v2/identity')
const admin = require('firebase-admin')
const crypto = require('crypto')

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

// Hrvatski i engleski nazivi mjeseci (mala slova) -> broj mjeseca. Koristi se
// samo kao rezervni pokusaj pogadanja datuma iz obicnog teksta stranice, kad
// stranica nema strukturirane (schema.org Event) podatke.
const MJESECI = {
  sijecnja: 1, veljace: 2, ozujka: 3, travnja: 4, svibnja: 5, lipnja: 6,
  srpnja: 7, kolovoza: 8, rujna: 9, listopada: 10, studenog: 11, studenoga: 11,
  prosinca: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12,
}

// Best-effort pokusaj: potraz u obicnom tekstu stranice datum koji je u
// buducnosti (ili danas) i unutar sljedece 3 godine — to je najvjerojatnije
// datum odrzavanja utrke, a ne npr. godina u podnozju stranice. Nikad ne
// garantira tocnost, admin ga uvijek vidi u formi i moze ispraviti prije spremanja.
function pogodiDatumIzTeksta(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')

  const now = new Date()
  const danas = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const maxDatum = new Date(now.getFullYear() + 3, 0, 1)
  const kandidati = []

  function dodaj(d) {
    if (!isNaN(d) && d >= danas && d <= maxDatum) kandidati.push(d)
  }

  // 21.11.2026. ili 21. 11. 2026
  for (const m of text.matchAll(/\b(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})\.?/g)) {
    dodaj(new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])))
  }
  // 21/11/2026
  for (const m of text.matchAll(/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g)) {
    dodaj(new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])))
  }
  // 2026-11-21
  for (const m of text.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b/g)) {
    dodaj(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  }
  // 21. studenog 2026. / 21 November 2026 (dan pa mjesec)
  const nazivi = Object.keys(MJESECI).join('|')
  const reDanMjesec = new RegExp(`\\b(\\d{1,2})\\.?\\s+(${nazivi})\\.?\\s+(\\d{4})\\b`, 'gi')
  for (const m of text.matchAll(reDanMjesec)) {
    const mjesec = MJESECI[m[2].toLowerCase()]
    dodaj(new Date(Number(m[3]), mjesec - 1, Number(m[1])))
  }
  // November 7, 2026 (mjesec pa dan - anglosaksonski poredak)
  const reMjesecDan = new RegExp(`\\b(${nazivi})\\.?\\s+(\\d{1,2}),?\\s+(\\d{4})\\b`, 'gi')
  for (const m of text.matchAll(reMjesecDan)) {
    const mjesec = MJESECI[m[1].toLowerCase()]
    dodaj(new Date(Number(m[3]), mjesec - 1, Number(m[2])))
  }

  if (kandidati.length === 0) return null
  kandidati.sort((a, b) => a - b)
  const d = kandidati[0]
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

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

  // Nazivane HTML entitete koje stranice cesto koriste u naslovima (crtice,
  // navodnici...) - brojcane entitete (&#8211; / &#x2013;) hvatamo generickim regexom.
  const HTML_ENTITETI = {
    nbsp: ' ', hellip: '\u2026', mdash: '\u2014', ndash: '\u2013',
    rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c',
    copy: '\u00a9', reg: '\u00ae', trade: '\u2122', deg: '\u00b0',
    laquo: '\u00ab', raquo: '\u00bb', apos: "'",
  }
  function decodeEntities(s) {
    return s
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
      .replace(/&([a-z]+);/gi, (m, name) => HTML_ENTITETI[name.toLowerCase()] ?? m)
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
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

  const guessedDate = event?.datum ? null : pogodiDatumIzTeksta(html)

  // Potraz link na Google Maps (start/cilj lokacija) ako ga stranica sadrzi
  let mapsLink = null
  const mapsMatch = html.match(
    /https:\/\/(?:www\.)?(?:goo\.gl\/maps|maps\.app\.goo\.gl|maps\.google\.[a-z.]+\/[^"'<>\s]*)[^"'<>\s]*/i,
  )
  if (mapsMatch) mapsLink = mapsMatch[0]

  return { title, description, image, event, guessedDate, mapsLink, url: target.toString() }
})

/**
 * "Podijeli kalendar": vlasnik dobije tajni link (token) koji zalijepi u
 * Google/Apple/Outlook kalendar kao "pretplatu" (subscribe by URL). Token
 * cuvamo u postavke/kalendar - to nije u firestore.rules pa ga klijent NE
 * moze citati/pisati izravno, samo preko ovih (owner-only) funkcija.
 */
exports.getCalendarShareLink = onCall(async (request) => {
  if (request.auth?.token?.email !== OWNER_EMAIL) {
    throw new HttpsError('permission-denied', 'Samo administrator smije upravljati kalendarom.')
  }
  const ref = admin.firestore().doc('postavke/kalendar')
  const snap = await ref.get()
  let token = snap.exists ? snap.data().token : null
  if (!token) {
    token = crypto.randomBytes(24).toString('hex')
    await ref.set({ token }, { merge: true })
  }
  return { token }
})

exports.rotateCalendarShareLink = onCall(async (request) => {
  if (request.auth?.token?.email !== OWNER_EMAIL) {
    throw new HttpsError('permission-denied', 'Samo administrator smije upravljati kalendarom.')
  }
  const token = crypto.randomBytes(24).toString('hex')
  await admin.firestore().doc('postavke/kalendar').set({ token }, { merge: true })
  return { token }
})

// RFC 5545: escape rezerviranih znakova u tekstualnim poljima (SUMMARY, DESCRIPTION...).
function icsEscape(text) {
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

// RFC 5545: redovi u .ics fileu ne smiju biti dulji od 75 okteta - dulje treba
// prelomiti, s razmakom na pocetku nastavka.
function icsFold(line) {
  if (Buffer.byteLength(line, 'utf8') <= 75) return line
  let result = ''
  let chunk = ''
  for (const ch of line) {
    if (Buffer.byteLength(chunk + ch, 'utf8') > 74) {
      result += (result ? '\r\n ' : '') + chunk
      chunk = ch
    } else {
      chunk += ch
    }
  }
  return result + (result ? '\r\n ' : '') + chunk
}

function icsLocalStamp(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${p(date.getMonth() + 1)}${p(date.getDate())}T${p(date.getHours())}${p(date.getMinutes())}${p(date.getSeconds())}`
}

function icsUtcStamp(date) {
  const p = (n) => String(n).padStart(2, '0')
  return `${date.getUTCFullYear()}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}T${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`
}

/**
 * Javni (bez Firebase Autha) .ics feed - ovo zovu Google/Apple/Outlook kalendar
 * kad se netko pretplati na link iz "Podijeli kalendar". Umjesto Firebase Autha
 * (kalendar aplikacije ga ne podrzavaju) provjeravamo tajni token iz linka.
 */
exports.calendarFeed = onRequest(async (req, res) => {
  const token = String(req.query.token || '')
  if (!token) {
    res.status(400).send('Nedostaje token.')
    return
  }
  const settingsSnap = await admin.firestore().doc('postavke/kalendar').get()
  if (!settingsSnap.exists || settingsSnap.data().token !== token) {
    res.status(403).send('Nevažeći link.')
    return
  }

  const racesSnap = await admin.firestore().collection('races').orderBy('datumPocetka', 'asc').get()
  const now = new Date()

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Borivert//Kalendar utrka//HR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Borivert - moje utrke',
    'X-WR-TIMEZONE:Europe/Zagreb',
    'REFRESH-INTERVAL;VALUE=DURATION:P1D',
    'X-PUBLISHED-TTL:P1D',
  ]

  racesSnap.forEach((doc) => {
    const r = doc.data()
    if (!r.datumPocetka?.toDate) return
    const start = r.datumPocetka.toDate()
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000) // pretpostavka: 4h trajanje

    const opis = []
    if (r.duljinaKm) opis.push(`${r.duljinaKm} km`)
    if (r.visinaM) opis.push(`${r.visinaM} m+`)
    if (r.statusPrijave) opis.push(`Status: ${r.statusPrijave}`)
    if (r.link) opis.push(r.link)

    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${doc.id}@borivert`)
    lines.push(`DTSTAMP:${icsUtcStamp(now)}`)
    lines.push(`DTSTART:${icsLocalStamp(start)}`)
    lines.push(`DTEND:${icsLocalStamp(end)}`)
    lines.push(icsFold(`SUMMARY:${icsEscape(r.naziv || 'Utrka')}`))
    if (r.lokacija) lines.push(icsFold(`LOCATION:${icsEscape(r.lokacija)}`))
    if (opis.length) lines.push(icsFold(`DESCRIPTION:${icsEscape(opis.join(' | '))}`))
    if (r.lokacijaLink) lines.push(icsFold(`URL:${icsEscape(r.lokacijaLink)}`))
    lines.push('END:VEVENT')
  })

  lines.push('END:VCALENDAR')

  res.set('Content-Type', 'text/calendar; charset=utf-8')
  res.set('Content-Disposition', 'inline; filename="borivert.ics"')
  res.set('Cache-Control', 'public, max-age=3600')
  res.status(200).send(lines.join('\r\n') + '\r\n')
})
