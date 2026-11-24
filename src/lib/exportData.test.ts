import { describe, expect, test } from 'vitest'
import * as topojsonClient from 'topojson-client'
import * as topojsonSimplify from 'topojson-simplify'
import type { FeatureCollection, Position } from 'geojson'
import type { Topology } from 'topojson-specification'
import { collection, kommune, norway, square } from '../test/fixtures'
import {
  buildCsv,
  buildExport,
  selectedBydelFeatureCollection,
  selectedDistriktFeatureCollection,
  selectedFeatureCollection,
} from './exportData'
import type { AreaGeometry, ExportFormat, KommuneProperties } from './types'

type Kommuner = FeatureCollection<AreaGeometry, KommuneProperties>

const oslo = kommune('0301', 'Oslo')
const asker = kommune('3203', 'Asker')
const reversed = (ring: Position[]) => [...ring].reverse()
/** Twice the signed area; negative when clockwise. */
const area = (ring: Position[]) => ring.slice(1).reduce((sum, [x, y], i) => sum + ring[i][0] * y - x * ring[i][1], 0)

/** The features in the exported file. */
async function exported(features: Kommuner, format: ExportFormat): Promise<Kommuner> {
  const json = JSON.parse(await buildExport(features, 'kommuner', format).blob.text())
  if (format === 'geojson') return json
  return topojsonClient.feature(json, (json as Topology).objects.kommuner) as unknown as Kommuner
}

describe.each<ExportFormat>(['geojson', 'topojson'])('buildExport %s', (format) => {
  test('has only two-dimensional positions, also at full detail', async () => {
    // At 100 % detail the app exports the presimplified topology, whose points carry a weight.
    const full = topojsonSimplify.presimplify(
      norway({ kommuner: collection([oslo, [square(0, 0)]], [asker, [square(1, 0)]]) }),
    )
    const features = selectedFeatureCollection(full, 'kommuner', new Set(['0301', '3203']))
    expect(await buildExport(features, 'kommuner', format).blob.text()).not.toContain('null')
    const result = await exported(features, format)
    const positions = result.features.flatMap((f) => (f.geometry.coordinates as Position[][]).flat())
    expect(positions).toHaveLength(10)
    expect(positions.filter((p) => p.length !== 2)).toEqual([])
  })

  test('turns exteriors clockwise and holes counter-clockwise', async () => {
    const hole = square(0.25, 0.25, 0.5)
    const { features } = await exported(collection([oslo, [reversed(square(0, 0)), hole]]), format)
    const [exterior, inner] = features[0].geometry.coordinates as Position[][]
    expect(area(exterior)).toBeLessThan(0)
    expect(area(inner)).toBeGreaterThan(0)
  })

  test('keeps the properties', async () => {
    const { features } = await exported(collection([oslo, [square(0, 0)]]), format)
    expect(features.map((f) => f.properties)).toEqual([oslo])
  })
})

describe('buildExport', () => {
  test('fixes every polygon of a MultiPolygon and leaves the input alone', async () => {
    const input: Kommuner = {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: oslo,
          geometry: { type: 'MultiPolygon', coordinates: [[square(0, 0)], [reversed(square(5, 8))]] },
        },
      ],
    }
    const before = structuredClone(input)
    const { features } = await exported(input, 'geojson')
    expect(features[0].geometry.coordinates).toEqual([[square(0, 0)], [square(5, 8)]])
    expect(input).toEqual(before)
  })

  test('names the TopoJSON object after the level and stores shared borders once', async () => {
    const { blob, extension } = buildExport(
      collection([oslo, [square(0, 0)]], [asker, [square(1, 0)]]),
      'kommuner',
      'topojson',
    )
    const topology = JSON.parse(await blob.text()) as Topology
    expect(extension).toBe('topojson')
    expect(Object.keys(topology.objects)).toEqual(['kommuner'])
    expect(topology.arcs).toHaveLength(3)
  })
})

describe('selecting features', () => {
  const p1 = { politidistriktnummer: 'p1', politidistriktnavn: 'En' }
  const p2 = { politidistriktnummer: 'p2', politidistriktnavn: 'To' }
  // With havgrense the areas are 3 wide, without it 1.
  const topology = norway({
    kommuner: collection([oslo, [square(0, 0, 3)]], [asker, [square(3, 0, 3)]]),
    kommunerUtenHavgrense: collection([oslo, [square(0, 0)]], [asker, [square(3, 0)]]),
    bydeler: collection([{ bydelnummer: '030101', bydelnavn: 'A', kommunenummer: '0301' }, [square(0, 0)]]),
    politidistrikter: collection([p1, [square(0, 0, 3)]], [p2, [square(3, 0, 3)]]),
    politidistrikterUtenHavgrense: collection([p1, [square(0, 0)]], [p2, [square(3, 0)]]),
  })
  const maxX = (f: { geometry: AreaGeometry }) =>
    Math.max(...(f.geometry.coordinates as Position[][]).flat().map((p) => p[0]))

  test('kommuner come from the requested havgrense layer', () => {
    const select = (layer: 'kommuner' | 'kommunerUtenHavgrense') =>
      selectedFeatureCollection(topology, layer, new Set(['0301'])).features
    expect(select('kommuner').map((f) => f.properties.kommunenummer)).toEqual(['0301'])
    expect(maxX(select('kommuner')[0])).toBe(3)
    expect(maxX(select('kommunerUtenHavgrense')[0])).toBe(1)
  })

  test('districts come from the requested havgrense layer', () => {
    const select = (med: boolean) =>
      selectedDistriktFeatureCollection(topology, 'politidistrikter', med, new Set(['p1'])).features
    expect(select(true).map((f) => f.properties)).toEqual([p1])
    expect(maxX(select(true)[0])).toBe(3)
    expect(maxX(select(false)[0])).toBe(1)
  })

  test('bydeler', () => {
    expect(selectedBydelFeatureCollection(topology, new Set(['030101'])).features).toHaveLength(1)
    expect(selectedBydelFeatureCollection(topology, new Set()).features).toEqual([])
  })
})

describe('buildCsv', () => {
  const csv = async (columns: string[], rows: Record<string, string>[]) =>
    new TextDecoder('utf-8', { ignoreBOM: true }).decode(await buildCsv(columns, rows).arrayBuffer())

  test('has a BOM, semicolons, CRLF and quoted values with leading zeros intact', async () => {
    expect(await csv(['nr', 'navn'], [{ nr: '0301', navn: 'Østfold' }])).toBe('﻿"nr";"navn"\r\n"0301";"Østfold"')
  })

  test('escapes quotes, keeps semicolons inside values and leaves missing values empty', async () => {
    expect(await csv(['a', 'b'], [{ a: 'x;"y"' }])).toBe('﻿"a";"b"\r\n"x;""y""";""')
  })
})
