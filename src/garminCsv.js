// Parser za CSV izvoz aktivnosti iz Garmin Connecta (Activities -> Export CSV),
// hrvatska lokalizacija stupaca. Namjerno cita po NAZIVU stupca (ne po fiksnoj
// poziciji) da bude otporniji na promjene redoslijeda/dodatne stupce u izvozu.

function parsirajCsvRedak(redak) {
  const polja = []
  let trenutno = ''
  let uNavodnicima = false
  for (let i = 0; i < redak.length; i++) {
    const c = redak[i]
    if (uNavodnicima) {
      if (c === '"') {
        if (redak[i + 1] === '"') {
          trenutno += '"'
          i++
        } else {
          uNavodnicima = false
        }
      } else {
        trenutno += c
      }
    } else if (c === '"') {
      uNavodnicima = true
    } else if (c === ',') {
      polja.push(trenutno)
      trenutno = ''
    } else {
      trenutno += c
    }
  }
  polja.push(trenutno)
  return polja
}

// Hrvatski format brojeva: "." je tisucica separator, "," je decimalni zarez.
// "--" i vrijednosti koje pocinju apostrofom (Garminove placeholder vrijednosti za
// "nema podatka", npr. nadmorska visina bez baromatra) tretiramo kao nepoznato.
function hrBroj(tekst) {
  if (tekst == null) return null
  const t = String(tekst).trim()
  if (!t || t === '--' || t.startsWith("'")) return null
  const broj = parseFloat(t.replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(broj) ? broj : null
}

function hrVrijemeUMinute(tekst) {
  if (!tekst) return null
  const dijelovi = tekst.split(':').map(Number)
  if (dijelovi.some((n) => Number.isNaN(n))) return null
  let sekunde = null
  if (dijelovi.length === 3) sekunde = dijelovi[0] * 3600 + dijelovi[1] * 60 + dijelovi[2]
  else if (dijelovi.length === 2) sekunde = dijelovi[0] * 60 + dijelovi[1]
  return sekunde == null ? null : sekunde / 60
}

export function parsirajGarminCsv(tekstCsv) {
  const redovi = tekstCsv.split(/\r\n|\n|\r/).filter((r) => r.trim().length > 0)
  if (redovi.length < 2) return []

  const zaglavlje = parsirajCsvRedak(redovi[0]).map((h) => h.trim())
  const idx = (naziv) => zaglavlje.indexOf(naziv)

  const iVrsta = idx('Vrsta aktivnosti')
  const iDatum = idx('Datum')
  const iNaslov = idx('Naslov')
  const iUdaljenost = idx('Udaljenost')
  const iVrijeme = idx('Vrijeme')
  const iProsjPuls = idx('Prosječni puls')
  const iMaxPuls = idx('Maksimalni puls')
  const iAerobniEfekt = idx('Aerobni efekt treniranja')
  const iUspon = idx('Ukupni uspon')

  if (iDatum === -1 || iVrijeme === -1) {
    throw new Error('Ovo ne izgleda kao Garmin Connect izvoz aktivnosti (nedostaju očekivani stupci).')
  }

  const aktivnosti = []
  for (let r = 1; r < redovi.length; r++) {
    const polja = parsirajCsvRedak(redovi[r])
    if (polja.length < 2) continue

    const datumTekst = polja[iDatum]
    if (!datumTekst) continue
    const datum = new Date(datumTekst.replace(' ', 'T'))
    if (Number.isNaN(datum.getTime())) continue

    aktivnosti.push({
      vrstaAktivnosti: (polja[iVrsta] || '').trim(),
      datum,
      naslov: (polja[iNaslov] || '').trim(),
      udaljenostKm: hrBroj(polja[iUdaljenost]),
      trajanjeMin: hrVrijemeUMinute(polja[iVrijeme]),
      prosjecniPuls: hrBroj(polja[iProsjPuls]),
      maksimalniPuls: hrBroj(polja[iMaxPuls]),
      aerobniEfekt: hrBroj(polja[iAerobniEfekt]),
      usponM: hrBroj(polja[iUspon]),
    })
  }
  return aktivnosti
}

// Stabilan (ne-kriptografski) ID za dediupliciranje pri ponovnom uvozu - ista
// aktivnost (isti datum+naslov) uvijek dobije isti Firestore document ID, pa ponovni
// upload istog/preklapajuceg izvoza samo prepise iste zapise umjesto da ih udvostruci.
export function generirajIdAktivnosti(aktivnost) {
  const kljuc = `${aktivnost.datum.toISOString()}_${aktivnost.naslov}`
  let h = 0
  for (let i = 0; i < kljuc.length; i++) {
    h = (h * 31 + kljuc.charCodeAt(i)) | 0
  }
  return 'a' + Math.abs(h).toString(36)
}
