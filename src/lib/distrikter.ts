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
  /** Where its codes are documented: the SSB KLASS classification, or another source. */
  kildeUrl: string
  /** Property names on district features and on kommuner, as written by data:distrikter. */
  idField: string
  nameField: string
  /** Appended to a single district's name in filenames, when the name doesn't say what it is. */
  filnavnSuffiks?: string
  /** List the districts under their fylke — the one most of a district's kommuner are in. */
  listeEtterFylke?: boolean
  /** A grouping of kommuner by a property rather than a geographic region, so its
   *  "districts" are not contiguous areas (e.g. sentralitet). */
  ikkeSammenhengende?: boolean
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
    kildeUrl: 'https://www.ssb.no/klass/klassifikasjoner/109',
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
    kildeUrl: 'https://kartkatalog.geonorge.no/metadata/c4436a5f-1e22-461a-8209-786f7052acb5',
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
    kildeUrl: 'https://www.ssb.no/klass/klassifikasjoner/543',
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
    kildeUrl: 'https://www.ssb.no/klass/klassifikasjoner/108',
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
    kildeUrl: 'https://www.ssb.no/klass/klassifikasjoner/106',
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
    kildeUrl: 'https://www.ssb.no/klass/klassifikasjoner/105',
    idField: 'helseregionnummer',
    nameField: 'helseregionnavn',
    objects: { med: 'helseregioner', uten: 'helseregionerUtenHavgrense' },
  },
  familievernregioner: {
    tittel: 'Familievernregioner',
    entall: 'familievernregion',
    flertall: 'familievernregioner',
    artikkel: 'én',
    kilde: 'SSB, Standard for familievernregioner (Bufetat)',
    kildeUrl: 'https://www.ssb.no/klass/klassifikasjoner/557',
    idField: 'familievernregionnummer',
    nameField: 'familievernregionnavn',
    filnavnSuffiks: 'familievernregion',
    objects: { med: 'familievernregioner', uten: 'familievernregionerUtenHavgrense' },
  },
  barnevernsregioner: {
    tittel: 'Barnevernsregioner',
    entall: 'barnevernsregion',
    flertall: 'barnevernsregioner',
    artikkel: 'én',
    kilde: 'SSB, Standard for barnevernsregioner (Bufetat, med Oslo som egen region)',
    kildeUrl: 'https://www.ssb.no/klass/klassifikasjoner/563',
    idField: 'barnevernsregionnummer',
    nameField: 'barnevernsregionnavn',
    filnavnSuffiks: 'barnevernsregion',
    objects: { med: 'barnevernsregioner', uten: 'barnevernsregionerUtenHavgrense' },
  },
  reiselivsregioner: {
    tittel: 'Reiselivsregioner',
    entall: 'reiselivsregion',
    flertall: 'reiselivsregioner',
    artikkel: 'én',
    kilde: 'SSB, Standard for reiselivsregioner',
    kildeUrl: 'https://www.ssb.no/klass/klassifikasjoner/527',
    idField: 'reiselivsregionnummer',
    nameField: 'reiselivsregionnavn',
    filnavnSuffiks: 'reiselivsregion',
    listeEtterFylke: true,
    objects: { med: 'reiselivsregioner', uten: 'reiselivsregionerUtenHavgrense' },
  },
  samiskeValgkretser: {
    tittel: 'Samiske valgkretser',
    entall: 'samisk valgkrets',
    flertall: 'samiske valgkretser',
    artikkel: 'én',
    kilde: 'SSB, Standard for samiske valgkretser (sametingsvalg)',
    kildeUrl: 'https://www.ssb.no/klass/klassifikasjoner/581',
    idField: 'samiskvalgkretsnummer',
    nameField: 'samiskvalgkretsnavn',
    objects: { med: 'samiskeValgkretser', uten: 'samiskeValgkretserUtenHavgrense' },
  },
  sentralitet: {
    tittel: 'Sentralitet',
    entall: 'sentralitetsgruppe',
    flertall: 'sentralitetsgrupper',
    artikkel: 'én',
    kilde: 'SSB, Standard for sentralitet (2020). Gruppene er ikke sammenhengende områder, men alle kommuner med samme sentralitet',
    kildeUrl: 'https://www.ssb.no/klass/klassifikasjoner/128',
    idField: 'sentralitetnummer',
    nameField: 'sentralitetnavn',
    ikkeSammenhengende: true,
    objects: { med: 'sentralitet', uten: 'sentralitetUtenHavgrense' },
  },
  baregioner: {
    tittel: 'Bo- og arbeidsmarkedsregioner',
    entall: 'BA-region',
    flertall: 'BA-regioner',
    artikkel: 'én',
    kilde: 'TØI for Kommunal- og moderniseringsdepartementet (2019), kodet om til kommuneinndelingen 2024',
    kildeUrl: 'https://www.regjeringen.no/no/dokumenter/inndeling-av-kommuner-i-bo--og-arbeidsmarkedsregioner/id2662614/',
    idField: 'baregionnummer',
    nameField: 'baregionnavn',
    filnavnSuffiks: 'BA-region',
    listeEtterFylke: true,
    objects: { med: 'baregioner', uten: 'baregionerUtenHavgrense' },
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
