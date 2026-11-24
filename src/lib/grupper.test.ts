import { expect, test } from 'vitest'
import { kommune } from '../test/fixtures'
import { fylkeRekkefolge, fylkeSeksjoner } from './grupper'

const fylker = ['03', '32', '31'].map((id) => ({ id, navn: `Fylke ${id}` }))
const gruppe = (id: string) => ({ id, navn: `Gruppe ${id}` })

test('fylker come in SSB order, unknown ones last by number', () => {
  const sorted = ['99', '56', '98', '31', '32', '03'].sort((a, b) => fylkeRekkefolge(a) - fylkeRekkefolge(b))
  expect(sorted).toEqual(['03', '32', '31', '56', '98', '99'])
})

test('groups are listed under the fylke most of their kommuner are in, in the order of the fylker', () => {
  const kommuner = new Map([
    ['a', [kommune('3101', 'A'), kommune('3102', 'B'), kommune('0301', 'C')]],
    ['b', [kommune('0301', 'D')]],
    ['c', [kommune('3103', 'E')]],
  ])
  expect(fylkeSeksjoner([gruppe('a'), gruppe('b'), gruppe('c')], kommuner, fylker)).toEqual([
    { id: '03', navn: 'Fylke 03', groups: [gruppe('b')] },
    { id: '31', navn: 'Fylke 31', groups: [gruppe('a'), gruppe('c')] },
  ])
})

test('a tie goes to the first fylke in SSB order, and a group without kommuner is left out', () => {
  const kommuner = new Map([['a', [kommune('3101', 'A'), kommune('3201', 'B')]]])
  expect(fylkeSeksjoner([gruppe('a'), gruppe('tom')], kommuner, fylker)).toEqual([
    { id: '32', navn: 'Fylke 32', groups: [gruppe('a')] },
  ])
})
