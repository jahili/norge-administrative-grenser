import { describe, expect, test } from 'vitest'
import { collection, grunnkretsFil, kommune, square } from '../test/fixtures'
import { grunnkretsFeatures, underomraderByKommune } from './grunnkretser'
import type { FeatureArgs } from './grunnkretser'
import type { GruppeKind } from './types'

const krets = (nr: string, lks?: string) => ({
  grunnkretsnummer: nr,
  grunnkretsnavn: `Krets ${nr}`,
  delomradenummer: nr.slice(0, 6),
  delomradenavn: `Delområde ${nr.slice(0, 6)}`,
  ...(lks && { levekarssonenummer: lks, levekarssonenavn: `Sone ${lks}` }),
  kommunenummer: nr.slice(0, 4),
})
const delomrade = (nr: string) => ({
  delomradenummer: nr,
  delomradenavn: `Delområde ${nr}`,
  kommunenummer: nr.slice(0, 4),
})
const sone = (nr: string) => ({
  levekarssonenummer: nr,
  levekarssonenavn: `Sone ${nr}`,
  kommunenummer: nr.slice(0, 4),
})

// 1103 has levekårssoner (which cross its delområder); 1111 has none.
const fil = grunnkretsFil({
  grunnkretser: collection<object>(
    [krets('11030101', '1103000001'), [square(0, 0)]],
    [krets('11030102', '1103000002'), [square(1, 0)]],
    [krets('11030201', '1103000002'), [square(2, 0)]],
    [krets('11110101'), [square(3, 0)]],
  ),
  grunnkretserUtenHavgrense: collection<object>([krets('11030101', '1103000001'), [square(0, 0, 0.5)]]),
  delomrader: collection(
    [delomrade('110301'), [square(0, 0)]],
    [delomrade('110302'), [square(2, 0)]],
    [delomrade('111101'), [square(3, 0)]],
  ),
  levekarssoner: collection([sone('1103000001'), [square(0, 0)]], [sone('1103000002'), [square(1, 0)]]),
})
const kommuner = new Map(['1103', '1111'].map((nr) => [nr, kommune(nr, `Kommune ${nr}`)]))

function args(
  kommunenumre: string[],
  { utelatte = [] as string[], kind = 'fylker' as GruppeKind, medHavgrense = true } = {},
): FeatureArgs {
  return [[fil], medHavgrense, 0, new Set(kommunenumre), new Set(utelatte), kommuner, kind]
}

describe('grunnkretsFeatures', () => {
  test('joins kommune and fylke fields, in a fixed column order', () => {
    const [feature] = grunnkretsFeatures('grunnkretser', ...args(['1103'])).features
    expect(Object.entries(feature.properties)).toEqual([
      ['grunnkretsnummer', '11030101'],
      ['grunnkretsnavn', 'Krets 11030101'],
      ['delomradenummer', '110301'],
      ['delomradenavn', 'Delområde 110301'],
      ['levekarssonenummer', '1103000001'],
      ['levekarssonenavn', 'Sone 1103000001'],
      ['kommunenummer', '1103'],
      ['kommunenavn', 'Kommune 1103'],
      ['kommunenavnOffisielt', 'Kommune 1103 offisielt'],
      ['fylkesnummer', '11'],
      ['fylkesnavn', 'Fylke 11'],
      ['fylkesnavnOffisielt', 'Fylke 11 offisielt'],
    ])
  })

  test('has the same columns in a kommune without levekårssoner, with empty values', () => {
    const { features } = grunnkretsFeatures('grunnkretser', ...args(['1103', '1111']))
    const uten = features.find((f) => f.properties.kommunenummer === '1111')!
    expect(Object.keys(uten.properties)).toEqual(Object.keys(features[0].properties))
    expect(uten.properties).toMatchObject({ levekarssonenummer: '', levekarssonenavn: '' })
  })

  test('adds the district when grouping by one', () => {
    const felter = { politidistriktnummer: 'p11', politidistriktnavn: 'Politi 11' }
    const a = args(['1103'], { kind: 'politidistrikter' })
    expect(grunnkretsFeatures('grunnkretser', ...a).features[0].properties).toMatchObject(felter)
    expect(grunnkretsFeatures('delomrader', ...a).features[0].properties).toMatchObject(felter)
    expect(grunnkretsFeatures('levekarssoner', ...a).features[0].properties).toMatchObject(felter)
  })

  test('only includes the selected kommuner', () => {
    const { features } = grunnkretsFeatures('grunnkretser', ...args(['1111']))
    expect(features.map((f) => f.properties.grunnkretsnummer)).toEqual(['11110101'])
  })

  test('leaving out a delområde drops it and its grunnkretser', () => {
    const a = args(['1103'], { utelatte: ['110301'] })
    const kretser = grunnkretsFeatures('grunnkretser', ...a).features
    expect(kretser.map((f) => f.properties.grunnkretsnummer)).toEqual(['11030201'])
    const omrader = grunnkretsFeatures('delomrader', ...a).features
    expect(omrader.map((f) => f.properties.delomradenummer)).toEqual(['110302'])
  })

  test('leaving out a levekårssone only drops that zone', () => {
    const a = args(['1103', '1111'], { utelatte: ['1103000001'] })
    const { features } = grunnkretsFeatures('levekarssoner', ...a)
    expect(features.map((f) => f.properties.levekarssonenummer)).toEqual(['1103000002'])
  })

  test('a kommune without levekårssoner has none to export', () => {
    expect(grunnkretsFeatures('levekarssoner', ...args(['1111'])).features).toEqual([])
  })

  test('uses the layer without havgrense when asked to', () => {
    const [feature] = grunnkretsFeatures('grunnkretser', ...args(['1103'], { medHavgrense: false })).features
    expect(Math.max(...(feature.geometry.coordinates as number[][][]).flat().map((p) => p[0]))).toBe(0.5)
  })
})

test('underomraderByKommune counts grunnkretser and skips kommuner without zones', () => {
  expect(underomraderByKommune(fil, 'delomrader').get('1103')).toEqual([
    { nummer: '110301', navn: 'Delområde 110301', grunnkretser: 2 },
    { nummer: '110302', navn: 'Delområde 110302', grunnkretser: 1 },
  ])
  const soner = underomraderByKommune(fil, 'levekarssoner')
  expect(soner.get('1103')?.map((s) => [s.nummer, s.grunnkretser])).toEqual([
    ['1103000001', 1],
    ['1103000002', 2],
  ])
  expect(soner.has('1111')).toBe(false)
})
