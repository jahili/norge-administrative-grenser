import { expect, test } from 'vitest'
import * as topojsonSimplify from 'topojson-simplify'
import type { Position } from 'geojson'
import { collection, kommune, norway } from '../test/fixtures'
import { simplifyToDetail } from './useSimplifiedTopology'

// A wobbly circle, so the points have different weights.
const ring: Position[] = Array.from({ length: 200 }, (_, i) => {
  const angle = (-2 * Math.PI * i) / 200
  const radius = 10 + Math.sin(i * 1.7) * 0.3 + Math.sin(i * 0.31)
  return [radius * Math.cos(angle), radius * Math.sin(angle)]
})
ring.push(ring[0])

const presimplified = topojsonSimplify.presimplify(norway({ kommuner: collection([kommune('0301', 'Oslo'), [ring]]) }))
const points = (percent: number) =>
  simplifyToDetail(presimplified, percent).topology.arcs.reduce((sum, arc) => sum + arc.length, 0)

test('more detail keeps more points', () => {
  const counts = [0, 25, 50, 75, 99, 100].map(points)
  expect(counts).toEqual([...counts].sort((a, b) => a - b))
  expect(counts[0]).toBeLessThan(10)
  expect(counts[2]).toBeGreaterThan(80)
  expect(counts[2]).toBeLessThan(120)
  expect(counts.at(-1)).toBe(201)
})

test('full detail removes nothing', () => {
  expect(simplifyToDetail(presimplified, 100).minWeight).toBe(0)
})
