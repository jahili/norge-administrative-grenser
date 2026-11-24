import { expect, test } from 'vitest'
import type { FeatureCollection } from 'geojson'
import { collection, kommune, square } from '../test/fixtures'
import { kartOmrader, sammeOmrader } from './kartlag'
import type { KartOmrade } from './kartlag'
import type { AreaGeometry, KommuneProperties } from './types'

const kommuner = collection([kommune('0301', 'Oslo'), [square(0, 0)]], [kommune('3203', 'Asker'), [square(1, 0)]])

function omrader(
  features: FeatureCollection<AreaGeometry, KommuneProperties>,
  selected: string[] = [],
): FeatureCollection<AreaGeometry, KartOmrade> {
  return {
    type: 'FeatureCollection',
    features: kartOmrader(features, (p) => ({
      navn: p.kommunenavn,
      nummer: p.kommunenummer,
      kontekst: '',
      selected: selected.includes(p.kommunenummer),
      handling: { type: 'kommune', id: p.kommunenummer },
    })),
  }
}

test('the same areas in another order or with another selection are the same', () => {
  const reordered = { ...kommuner, features: [...kommuner.features].reverse() }
  expect(sammeOmrader(omrader(kommuner), omrader(kommuner, ['0301']))).toBe(true)
  expect(sammeOmrader(omrader(kommuner), omrader(reordered, ['3203']))).toBe(true)
})

test('new geometries, or more or fewer areas, are not the same', () => {
  const fewer = { ...kommuner, features: kommuner.features.slice(1) }
  expect(sammeOmrader(omrader(kommuner), omrader(structuredClone(kommuner)))).toBe(false)
  expect(sammeOmrader(omrader(kommuner), omrader(fewer))).toBe(false)
  expect(sammeOmrader(omrader(fewer), omrader(kommuner))).toBe(false)
})
