// Checks the committed map data against what the app expects of it.
import { describe, expect, test } from 'vitest'
import * as topojsonClient from 'topojson-client'
import type { FeatureCollection, Position } from 'geojson'
import type { GeometryCollection } from 'topojson-specification'
import raw from './assets/norge-grenser.topojson?raw'
import type { NorwayTopologyType } from './hooks/useTopology'
import { DISTRIKT_KIND_LIST, DISTRIKT_KINDS } from './lib/distrikter'
import type { AreaGeometry } from './lib/types'

type ObjectName = keyof NorwayTopologyType['objects']

const topology = JSON.parse(raw) as NorwayTopologyType
const properties = (objectName: ObjectName) =>
  topology.objects[objectName].geometries.map((g) => g.properties as Record<string, string>)

function totalArea(objectName: ObjectName): number {
  const object = topology.objects[objectName] as GeometryCollection
  const { features } = topojsonClient.feature(topology, object) as FeatureCollection<AreaGeometry>
  const ringArea = (ring: Position[]) =>
    Math.abs(ring.slice(1).reduce((sum, [x, y], i) => sum + ring[i][0] * y - x * ring[i][1], 0) / 2)
  return features
    .flatMap(({ geometry }) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates))
    .reduce((sum, [exterior, ...holes]) => sum + ringArea(exterior) - holes.reduce((s, h) => s + ringArea(h), 0), 0)
}

test.each([
  ['kommuner', 'kommunerUtenHavgrense', 'kommunenummer'],
  ['fylker', 'fylkerUtenHavgrense', 'fylkesnummer'],
] as const)('%s uten havgrense are the same areas, but smaller', (med, uten, id) => {
  const ids = (objectName: ObjectName) => properties(objectName).map((p) => p[id]).sort()
  expect(ids(uten)).toEqual(ids(med))
  expect(totalArea(uten)).toBeLessThan(totalArea(med) * 0.9)
})

describe.each(DISTRIKT_KIND_LIST)('%s', (kind) => {
  const { idField, nameField, objects } = DISTRIKT_KINDS[kind]
  const kommuner = properties('kommuner')

  test.each([objects.med, objects.uten])('%s has exactly the districts the kommuner are in', (objectName) => {
    const ids = properties(objectName).map((p) => p[idField])
    expect([...ids].sort()).toEqual([...new Set(kommuner.map((k) => k[idField]))].sort())
  })

  test('every kommune has the name of its district', () => {
    const navn = new Map(properties(objects.med).map((p) => [p[idField], p[nameField]]))
    expect(kommuner.filter((k) => !k[nameField] || k[nameField] !== navn.get(k[idField]))).toEqual([])
  })
})
