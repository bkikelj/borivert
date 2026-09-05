import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { collection, doc, getDocs, orderBy, query, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../dateUtils'
import { parsirajGarminCsv, generirajIdAktivnosti } from '../garminCsv'
import {
  aktivnostiUDogadjaje,
  analizirajRazmakSvihUtrka,
  ekvivalentnaUdaljenostKm,
  izracunajTjednoOpterecenje,
  procijeniOmjerZaBuducuUtrku,
  procijeniOsobniMaxPuls,
} from '../opterecenje'
import { IconActivity, IconUpload, IconWarning } from './Icons'

const STATUS_STIL = {
  nisko: 'bg-surface-2 text-muted',
  'uravnoteženo': 'bg-good/15 text-good',
  'povišeno': 'bg-warn/15 text-warn',
  visoko: 'bg-long/15 text-long',
  'nedovoljno podataka': 'bg-surface-2 text-muted',
}

function StatusZnacka({ status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-mono ${STATUS_STIL[status] || STATUS_STIL.nisko}`}>
      {status}
    </span>
  )
}

export default function Opterecenje() {
  const { isOwner } = useAuth()
  const [races, setRaces] = useState([])
  const [aktivnosti, setAktivnosti] = useState([])
  const [status, setStatus] = useState('ucitavanje')
  const [uvozStatus, setUvozStatus] = useState(null) // { poruka, greska }
  const [uvozUTijeku, setUvozUTijeku] = useState(false)
  const fileInputRef = useRef(null)

  const load = useCallback(async () => {
    setStatus('ucitavanje')
    try {
      const [racesSnap, aktivnostiSnap] = await Promise.all([
        getDocs(query(collection(db, 'races'), orderBy('datumPocetka', 'asc'))),
        getDocs(query(collection(db, 'trainings'), orderBy('datum', 'desc'))),
      ])
      setRaces(racesSnap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setAktivnosti(
        aktivnostiSnap.docs.map((d) => {
          const data = d.data()
          return { id: d.id, ...data, datum: data.datum?.toDate ? data.datum.toDate() : new Date(data.datum) }
        }),
      )
      setStatus('ok')
    } catch (err) {
      console.error('Greška pri učitavanju opterećenja:', err)
      setStatus('greska')
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function handleFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUvozUTijeku(true)
    setUvozStatus(null)
    try {
      const tekst = await file.text()
      const uvezene = parsirajGarminCsv(tekst)
      if (!uvezene.length) {
        setUvozStatus({ greska: true, poruka: 'Nisam pronašao nijednu aktivnost u ovoj datoteci.' })
        return
      }

      // Firestore batch dopušta max. 500 pisanja - podijelimo ako treba.
      for (let i = 0; i < uvezene.length; i += 450) {
        const batch = writeBatch(db)
        for (const aktivnost of uvezene.slice(i, i + 450)) {
          const id = generirajIdAktivnosti(aktivnost)
          batch.set(doc(db, 'trainings', id), aktivnost, { merge: true })
        }
        await batch.commit()
      }

      setUvozStatus({ poruka: `Uvezeno ${uvezene.length} aktivnosti (${file.name}).` })
      load()
    } catch (err) {
      console.error('Greška pri uvozu CSV-a:', err)
      setUvozStatus({ greska: true, poruka: err.message || 'Ne mogu pročitati ovu datoteku.' })
    } finally {
      setUvozUTijeku(false)
    }
  }

  const osobniMaxPuls = useMemo(() => procijeniOsobniMaxPuls(aktivnosti), [aktivnosti])
  const dogadjaji = useMemo(() => aktivnostiUDogadjaje(aktivnosti), [aktivnosti])
  const trenutnoOpterecenje = useMemo(() => izracunajTjednoOpterecenje(dogadjaji), [dogadjaji])
  const razmakUpozorenja = useMemo(() => analizirajRazmakSvihUtrka(races), [races])

  const buduceUtrke = useMemo(() => {
    const danas = new Date()
    return races
      .filter((r) => r.datumPocetka?.toDate && r.datumPocetka.toDate() >= danas)
      .sort((a, b) => a.datumPocetka.toDate() - b.datumPocetka.toDate())
      .map((utrka) => ({
        utrka,
        razmak: razmakUpozorenja.get(utrka.id) || null,
        projekcija: procijeniOmjerZaBuducuUtrku(utrka, dogadjaji),
      }))
  }, [races, razmakUpozorenja, dogadjaji])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-10">
      <h1 className="font-display text-3xl font-bold">Opterećenje</h1>
      <p className="mt-1 text-sm text-muted">
        Grubi pregled trenutnog opterećenja i razmaka između utrka, temeljem tvojih uvezenih treninga i tempo-modela.
        Ovo je okviran signal za planiranje, ne dokazana medicinska procjena.
      </p>

      {isOwner && (
        <div className="mt-6 rounded-xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-lg font-bold">Uvezi Garmin CSV</h2>
              <p className="mt-0.5 text-sm text-muted">
                Garmin Connect → Activities → izvezi kao CSV → uploadaj ovdje. Ponovni upload istog razdoblja samo
                osvježi postojeće zapise, ne duplicira ih.
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uvozUTijeku}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-lg bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-60"
            >
              <IconUpload />
              {uvozUTijeku ? 'Uvozim...' : 'Odaberi CSV'}
            </button>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFile} className="hidden" />
          </div>
          {uvozStatus && (
            <p className={`mt-3 text-sm ${uvozStatus.greska ? 'text-long' : 'text-good'}`}>{uvozStatus.poruka}</p>
          )}
        </div>
      )}

      {status === 'ucitavanje' && <p className="mt-6 text-muted">Učitavanje...</p>}
      {status === 'greska' && <p className="mt-6 text-long">Ne mogu učitati podatke.</p>}

      {status === 'ok' && (
        <>
          <div className="mt-6 rounded-xl border border-line bg-surface p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-bold">Trenutno opterećenje</h2>
                <p className="mt-0.5 text-sm text-muted">
                  {aktivnosti.length === 0
                    ? 'Još nema uvezenih aktivnosti.'
                    : `${aktivnosti.length} uvezenih aktivnosti · osobni max puls (procjena): ${osobniMaxPuls} otk./min`}
                </p>
              </div>
              <StatusZnacka status={trenutnoOpterecenje.status} />
            </div>
            {trenutnoOpterecenje.omjer != null && (
              <p className="mt-2 font-mono text-sm text-muted">
                zadnjih 7 dana naspram prosjeka zadnja 4 tjedna: {trenutnoOpterecenje.omjer.toFixed(2)}×
              </p>
            )}
          </div>

          <div className="mt-6">
            <h2 className="font-display text-lg font-bold">Nadolazeće utrke</h2>
            {buduceUtrke.length === 0 && <p className="mt-2 text-sm text-muted">Nema nadolazećih utrka.</p>}
            <ul className="mt-3 space-y-3">
              {buduceUtrke.map(({ utrka, razmak, projekcija }) => (
                <li key={utrka.id} className="rounded-xl border border-line bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-display font-bold">{utrka.naziv}</p>
                      <p className="font-mono text-xs text-muted">
                        {formatDate(utrka.datumPocetka)} · {utrka.duljinaKm || '?'} km
                        {utrka.visinaM ? ` · ${utrka.visinaM} m+` : ''}
                        {utrka.duljinaKm ? ` (eq. ${ekvivalentnaUdaljenostKm(utrka.duljinaKm, utrka.visinaM).toFixed(0)} km)` : ''}
                      </p>
                    </div>
                    {projekcija?.status && <StatusZnacka status={projekcija.status} />}
                  </div>

                  {razmak && (
                    <p className="mt-3 flex items-start gap-2 text-sm text-warn">
                      <IconWarning className="mt-0.5 flex-none" />
                      Razmak {razmak.smjer === 'prije' ? 'od' : 'do'} "{razmak.susjed.naziv}" je {razmak.gapDana} dana,
                      preporučeno je barem {razmak.potrebnoDana}
                      {razmak.lagan ? ' (tretirano kao lagan napor)' : ''}.
                    </p>
                  )}

                  {!razmak && projekcija?.status && projekcija.status !== 'nisko' && projekcija.status !== 'uravnoteženo' && (
                    <p className="mt-3 flex items-start gap-2 text-sm text-warn">
                      <IconActivity className="mt-0.5 flex-none" />
                      Uz stvarno opterećenje iz treninga, do ove utrke bi omjer bio {projekcija.omjer?.toFixed(2)}× —
                      malo povišeno.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}
