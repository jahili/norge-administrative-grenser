import { describe, expect, test } from 'vitest'
import { bydel, kommune } from '../test/fixtures'
import {
  bydelSelectionFilenameStem,
  distriktSelectionFilenameStem,
  fylkeSelectionFilenameStem,
  grunnkretsSelectionFilenameStem,
  selectionFilenameStem,
} from './filename'
import type { GrunnkretsNivå, KommuneProperties } from './types'

const oslo = kommune('0301', 'Oslo')
const asker = kommune('3203', 'Asker')
const baerum = kommune('3201', 'Bærum')
const groups = [
  { id: '03', navn: 'Oslo' },
  { id: '32', navn: 'Akershus' },
]
const byGroup = new Map([
  ['03', [oslo]],
  ['32', [asker, baerum]],
])

describe('selectionFilenameStem', () => {
  const stem = (...kommuner: KommuneProperties[]) => selectionFilenameStem(kommuner, 'fylker', groups, byGroup)

  test('one kommune', () => expect(stem(baerum)).toBe('bærum'))
  test('the only kommune in a group', () => expect(stem(oslo)).toBe('oslo'))
  test('every kommune in one fylke', () => expect(stem(asker, baerum)).toBe('akershus-kommuner'))
  test('kommuner across fylker', () => expect(stem(oslo, asker)).toBe('2-kommuner-utvalg'))
  test('part of a fylke', () => {
    const larger = new Map([['32', [asker, baerum, kommune('3205', 'Lillestrøm')]]])
    expect(selectionFilenameStem([asker, baerum], 'fylker', groups, larger)).toBe('2-kommuner-utvalg')
  })
  test('every kommune in one district, with the suffix for that kind', () => {
    const distrikter = [{ id: 'p32', navn: 'Øst' }]
    const byDistrikt = new Map([['p32', [asker, baerum]]])
    expect(selectionFilenameStem([asker, baerum], 'politidistrikter', distrikter, byDistrikt)).toBe(
      'øst-politidistrikt-kommuner',
    )
  })
  test('Sami letters and slashes', () => {
    expect(stem(kommune('5612', 'Guovdageaidnu / Kautokeino'))).toBe('guovdageaidnu-kautokeino')
    expect(stem(kommune('5610', 'Kárášjohka'))).toBe('kárášjohka')
  })
})

test('fylkeSelectionFilenameStem', () => {
  const fylke = (fylkesnummer: string, navn: string) => ({ fylkesnummer, fylkesnavn: navn, fylkesnavnOffisielt: navn })
  expect(fylkeSelectionFilenameStem([fylke('15', 'Møre og Romsdal')])).toBe('møre-og-romsdal-fylke')
  expect(fylkeSelectionFilenameStem([fylke('03', 'Oslo'), fylke('32', 'Akershus')])).toBe('2-fylker-utvalg')
})

describe('bydelSelectionFilenameStem', () => {
  const a = bydel('030101', 'Gamle Oslo')
  const b = bydel('030102', 'Grünerløkka')
  const c = bydel('460101', 'Arna')
  const byKommune = new Map([
    ['0301', [a, b]],
    ['4601', [c]],
  ])
  const stem = (...bydeler: (typeof a)[]) => bydelSelectionFilenameStem(bydeler, byKommune, [oslo])

  test('one bydel', () => expect(stem(b)).toBe('grünerløkka'))
  test('every bydel in a kommune', () => expect(stem(a, b)).toBe('oslo-bydeler'))
  test('bydeler across kommuner', () => expect(stem(a, c)).toBe('2-bydeler-utvalg'))
})

describe('distriktSelectionFilenameStem', () => {
  const d = [
    { id: '1', navn: 'Øst' },
    { id: '2', navn: 'Vest' },
    { id: '3', navn: 'Nord' },
  ]

  test('one, with a suffix', () => {
    expect(distriktSelectionFilenameStem('politidistrikter', [d[0]], d)).toBe('øst-politidistrikt')
  })
  test('one whose name says what it is', () => {
    const sentral = { id: '1', navn: 'Oslo 110-sentral' }
    expect(distriktSelectionFilenameStem('distrikter110', [sentral], d)).toBe('oslo-110-sentral')
  })
  test('some', () => {
    expect(distriktSelectionFilenameStem('landsdeler', d.slice(0, 2), d)).toBe('2-landsdeler-utvalg')
  })
  test('all', () => {
    expect(distriktSelectionFilenameStem('okonomiskeRegioner', d, d)).toBe('alle-økonomiske-regioner')
  })
})

describe('grunnkretsSelectionFilenameStem', () => {
  const stem = (nivå: GrunnkretsNivå, kommuner: KommuneProperties[], someLeftOut = false) =>
    grunnkretsSelectionFilenameStem(nivå, kommuner, 'fylker', groups, byGroup, someLeftOut)

  test('one kommune', () => expect(stem('grunnkretser', [oslo])).toBe('oslo-grunnkretser'))
  test('a whole fylke', () => expect(stem('delomrader', [asker, baerum])).toBe('akershus-delområder'))
  test('kommuner across fylker', () => {
    expect(stem('levekarssoner', [oslo, asker])).toBe('levekårssoner-i-2-kommuner')
  })
  test('some left out', () => expect(stem('grunnkretser', [oslo], true)).toBe('oslo-grunnkretser-utvalg'))
})
