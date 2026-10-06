import type {
  Distrikt110Properties,
  DistriktKind,
  GruppeKind,
  KommuneGruppe,
  KommuneProperties,
  PolitidistriktProperties,
} from './types'

export type DistriktProperties = PolitidistriktProperties | Distrikt110Properties

interface DistriktKindInfo {
  /** Heading / option label, e.g. "Politidistrikter". */
  tittel: string
  entall: string
  flertall: string
  /** Where the division comes from, shown next to the list. */
  kilde: string
  /** Bundled topology objects with and without havgrense. */
  objects: { med: DistriktKind; uten: `${DistriktKind}UtenHavgrense` }
}

export const DISTRIKT_KINDS: Record<DistriktKind, DistriktKindInfo> = {
  politidistrikter: {
    tittel: 'Politidistrikter',
    entall: 'politidistrikt',
    flertall: 'politidistrikter',
    kilde: 'SSB, Standard for politidistrikt',
    objects: { med: 'politidistrikter', uten: 'politidistrikterUtenHavgrense' },
  },
  distrikter110: {
    tittel: '110-distrikter',
    entall: '110-distrikt',
    flertall: '110-distrikter',
    kilde: 'DSB, Brannalarmsentraler',
    objects: { med: 'distrikter110', uten: 'distrikter110UtenHavgrense' },
  },
}

export function toDistrikt(props: DistriktProperties): KommuneGruppe {
  return 'politidistriktnummer' in props
    ? { id: props.politidistriktnummer, navn: props.politidistriktnavn }
    : { id: props.distrikt110id, navn: props.distrikt110navn }
}

/** The id of the fylke or district of `kind` a kommune belongs to. */
export function kommuneGruppeId(kommune: KommuneProperties, kind: GruppeKind): string {
  if (kind === 'fylker') return kommune.fylkesnummer
  return kind === 'politidistrikter' ? kommune.politidistriktnummer : kommune.distrikt110id
}
