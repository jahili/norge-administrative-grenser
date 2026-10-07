import { DISTRIKT_KIND_LIST, DISTRIKT_KINDS } from './distrikter'
import type { ExportGranularity } from './types'

export interface KolonneInfo {
  beskrivelse: string
  /** Where the codes are documented, when that is useful for joining. */
  kilde?: { navn: string; url: string }
}

const KARTVERKET = { navn: 'Kartverket / SSB', url: 'https://www.ssb.no/klass/klassifikasjoner/131' }

const BASE_KOLONNER: Record<string, KolonneInfo> = {
  fylkesnummer: {
    beskrivelse: 'Fylkesnummer, 2 sifre som tekst (f.eks. «03»)',
    kilde: { navn: 'SSB, Standard for fylkesinndeling', url: 'https://www.ssb.no/klass/klassifikasjoner/104' },
  },
  fylkesnavn: { beskrivelse: 'Fylkets norske navn' },
  fylkesnavnOffisielt: {
    beskrivelse:
      'Fylkets fulle offisielle navn med samiske og kvenske navn, i offisiell rekkefølge (f.eks. «Troms - Romsa - Tromssa»). Lik fylkesnavn for fylker med bare norsk navn',
  },
  kommunenummer: {
    beskrivelse: 'Kommunenummer, 4 sifre som tekst (f.eks. «0301»). De to første sifrene er fylkesnummeret',
    kilde: KARTVERKET,
  },
  kommunenavn: { beskrivelse: 'Kommunens norske navn' },
  kommunenavnOffisielt: {
    beskrivelse:
      'Kommunens fulle offisielle navn med samiske og kvenske navn, i offisiell rekkefølge (f.eks. «Guovdageaidnu - Kautokeino»). Lik kommunenavn for kommuner med bare norsk navn',
  },
  bydelnummer: {
    beskrivelse:
      'Bydelsnummer, 6 sifre som tekst: kommunenummer + 2 sifre (f.eks. «030101»). Fredrikstad har ingen offisielle bydelsnumre, så der er numrene laget av appen',
  },
  bydelnavn: { beskrivelse: 'Bydelens eller delområdets navn' },
  grunnkretsnummer: {
    beskrivelse:
      'Grunnkretsnummer, 8 sifre som tekst: kommunenummer + 2 sifre delområde + 2 sifre krets (f.eks. «03012308»). Brukes i SSBs statistikk på grunnkretsnivå',
    kilde: {
      navn: 'SSB, Standard for delområde- og grunnkretsinndeling',
      url: 'https://www.ssb.no/klass/klassifikasjoner/1',
    },
  },
  grunnkretsnavn: { beskrivelse: 'Grunnkretsens navn (skrivemåte fra Kartverket)' },
  delomradenummer: {
    beskrivelse: 'Delområdenummer, 6 sifre som tekst: de 6 første sifrene i grunnkretsnummeret (SSB skriver det med «00» til slutt)',
  },
  delomradenavn: { beskrivelse: 'Delområdets navn' },
}

/** Describes one exported column: fylke/kommune/bydel fields, or a district kind's id/name field. */
export function kolonneInfo(kolonne: string): KolonneInfo | undefined {
  if (kolonne in BASE_KOLONNER) return BASE_KOLONNER[kolonne]
  for (const kind of DISTRIKT_KIND_LIST) {
    const { idField, nameField, entall, kilde, kildeUrl } = DISTRIKT_KINDS[kind]
    if (kolonne === idField) {
      return {
        beskrivelse:
          kind === 'distrikter110'
            ? `Id for ${entall}et (DSBs lokalId)`
            : `Kode for ${entall} i SSBs klassifikasjon`,
        kilde: { navn: kilde, url: kildeUrl },
      }
    }
    if (kolonne === nameField) return { beskrivelse: `Navn på ${entall}` }
  }
  return undefined
}

/** The column to join your own data on, for each export level. */
export function nokkelKolonne(granularity: ExportGranularity): string {
  if (granularity === 'fylker') return 'fylkesnummer'
  if (granularity === 'kommuner') return 'kommunenummer'
  if (granularity === 'bydeler') return 'bydelnummer'
  if (granularity === 'grunnkretser') return 'grunnkretsnummer'
  return DISTRIKT_KINDS[granularity].idField
}
