import type { DistriktKind, GruppeKind, KommuneGruppe, KommuneProperties } from './types'

/** A district feature's properties: its own id and name field (see DISTRIKT_KINDS). */
export type DistriktProperties = Record<string, string>

interface DistriktKindInfo {
  /** Heading / option label, e.g. "Politidistrikter". */
  tittel: string
  entall: string
  flertall: string
  /** Indefinite article for the singular: "ett politidistrikt", "én landsdel". */
  artikkel: 'ett' | 'én'
  /** Where the division comes from, shown next to the list. */
  kilde: string
  /** Property names on district features and on kommuner, as written by data:distrikter. */
  idField: string
  nameField: string
  /** Appended to a single district's name in filenames, when the name doesn't say what it is. */
  filnavnSuffiks?: string
  /** List the districts under their fylke (only for divisions that nest within fylker). */
  listeEtterFylke?: boolean
  /** Bundled topology objects with and without havgrense. */
  objects: { med: DistriktKind; uten: `${DistriktKind}UtenHavgrense` }
}

/** Keep in sync with DISTRIKTER in data-pipeline/scripts/05-add-distrikter.mjs. */
export const DISTRIKT_KINDS: Record<DistriktKind, DistriktKindInfo> = {
  politidistrikter: {
    tittel: 'Politidistrikter',
    entall: 'politidistrikt',
    flertall: 'politidistrikter',
    artikkel: 'ett',
    kilde: 'SSB, Standard for politidistrikt',
    idField: 'politidistriktnummer',
    nameField: 'politidistriktnavn',
    filnavnSuffiks: 'politidistrikt',
    objects: { med: 'politidistrikter', uten: 'politidistrikterUtenHavgrense' },
  },
  distrikter110: {
    tittel: '110-distrikter',
    entall: '110-distrikt',
    flertall: '110-distrikter',
    artikkel: 'ett',
    kilde: 'DSB, Brannalarmsentraler',
    idField: 'distrikt110id',
    nameField: 'distrikt110navn',
    objects: { med: 'distrikter110', uten: 'distrikter110UtenHavgrense' },
  },
  valgdistrikter: {
    tittel: 'Valgdistrikter',
    entall: 'valgdistrikt',
    flertall: 'valgdistrikter',
    artikkel: 'ett',
    kilde: 'SSB, Standard for valgdistrikt (stortingsvalg)',
    idField: 'valgdistriktnummer',
    nameField: 'valgdistriktnavn',
    objects: { med: 'valgdistrikter', uten: 'valgdistrikterUtenHavgrense' },
  },
  okonomiskeRegioner: {
    tittel: 'Økonomiske regioner',
    entall: 'økonomisk region',
    flertall: 'økonomiske regioner',
    artikkel: 'én',
    kilde: 'SSB, Standard for økonomiske regioner',
    idField: 'okonomiskregionnummer',
    nameField: 'okonomiskregionnavn',
    filnavnSuffiks: 'økonomisk region',
    listeEtterFylke: true,
    objects: { med: 'okonomiskeRegioner', uten: 'okonomiskeRegionerUtenHavgrense' },
  },
  landsdeler: {
    tittel: 'Landsdeler',
    entall: 'landsdel',
    flertall: 'landsdeler',
    artikkel: 'én',
    kilde: 'SSB, Standard for landsdelsinndeling (via fylkene)',
    idField: 'landsdelnummer',
    nameField: 'landsdelnavn',
    filnavnSuffiks: 'landsdel',
    objects: { med: 'landsdeler', uten: 'landsdelerUtenHavgrense' },
  },
  helseregioner: {
    tittel: 'Helseregioner',
    entall: 'helseregion',
    flertall: 'helseregioner',
    artikkel: 'én',
    kilde: 'SSB, Standard for helseregioner (kommunekobling fra 2020, oversatt til dagens kommunenumre)',
    idField: 'helseregionnummer',
    nameField: 'helseregionnavn',
    objects: { med: 'helseregioner', uten: 'helseregionerUtenHavgrense' },
  },
}

export const DISTRIKT_KIND_LIST = Object.keys(DISTRIKT_KINDS) as DistriktKind[]

/** A district feature's `{ id, navn }`; the kind is recognised by which id field it carries. */
export function toDistrikt(props: DistriktProperties): KommuneGruppe {
  const kind = DISTRIKT_KIND_LIST.find((k) => DISTRIKT_KINDS[k].idField in props)
  if (!kind) throw new Error(`Not a district: ${JSON.stringify(props)}`)
  const { idField, nameField } = DISTRIKT_KINDS[kind]
  return { id: props[idField], navn: props[nameField] }
}

/** The id of the fylke or district of `kind` a kommune belongs to. */
export function kommuneGruppeId(kommune: KommuneProperties, kind: GruppeKind): string {
  return kind === 'fylker' ? kommune.fylkesnummer : kommune[DISTRIKT_KINDS[kind].idField]
}
