import { describe, expect, test } from 'vitest'
import { bydel, kommune } from '../test/fixtures'
import { initialState, reducer, scopedReducer } from './useSelection'
import type { SelectionState } from './useSelection'

const oslo = kommune('0301', 'Oslo')
const asker = kommune('3203', 'Asker')
const baerum = kommune('3201', 'Bærum')
const osloBydeler = [bydel('030101', 'A'), bydel('030102', 'B')]
const bydelsByKommune = new Map([['0301', osloBydeler]])

const state = (groups: string[], kommuner: string[] = [], bydeler: string[] = []): SelectionState => ({
  selectedGroups: new Set(groups),
  selectedKommuner: new Set(kommuner),
  selectedBydeler: new Set(bydeler),
})

describe('groups', () => {
  const toggleOslo = { type: 'toggle-group', groupId: '03', kommuner: [oslo], bydelsByKommune } as const

  test('selecting a group does not select its kommuner', () => {
    expect(reducer(initialState, { ...toggleOslo, kommuner: [oslo] })).toEqual(state(['03']))
  })

  test('deselecting a group removes its kommuner and bydeler, and only those', () => {
    const before = state(['03', '32'], ['0301', '3203'], ['030101', '460101'])
    expect(reducer(before, { ...toggleOslo, kommuner: [oslo] })).toEqual(state(['32'], ['3203'], ['460101']))
  })

  test('toggle all selects the rest first, then clears everything', () => {
    const all = reducer(state(['03'], ['0301'], ['030101']), { type: 'toggle-all-groups', allGroupIds: ['03', '32'] })
    expect(all).toEqual(state(['03', '32'], ['0301'], ['030101']))
    expect(reducer(all, { type: 'toggle-all-groups', allGroupIds: ['03', '32'] })).toEqual(state([]))
  })

  test('toggle several selects the missing ones, then deselects them with their kommuner', () => {
    const toggle = (s: SelectionState) =>
      reducer(s, { type: 'toggle-groups', groupIds: ['03', '32'], kommuner: [oslo, asker], bydelsByKommune })
    expect(toggle(state(['03'], ['0301']))).toEqual(state(['03', '32'], ['0301']))
    expect(toggle(state(['03', '32', '46'], ['0301', '3203', '4601'], ['030101']))).toEqual(state(['46'], ['4601']))
  })
})

describe('kommuner', () => {
  test('deselecting a kommune removes its bydeler', () => {
    const toggle = (s: SelectionState) =>
      reducer(s, { type: 'toggle-kommune', kommunenummer: '0301', bydeler: osloBydeler })
    expect(toggle(state(['03']))).toEqual(state(['03'], ['0301']))
    expect(toggle(state(['03'], ['0301'], ['030101', '460101']))).toEqual(state(['03'], [], ['460101']))
  })

  test('toggle all in a group completes a partial selection, then clears it', () => {
    const toggle = (s: SelectionState) =>
      reducer(s, { type: 'toggle-all-in-group', kommuner: [asker, baerum], bydelsByKommune })
    const all = toggle(state(['32'], ['3203', '0301']))
    expect(all).toEqual(state(['32'], ['3203', '3201', '0301']))
    expect(toggle(all)).toEqual(state(['32'], ['0301']))
  })

  test('clearing all in a group also clears its bydeler', () => {
    const before = state(['03'], ['0301'], ['030101'])
    expect(reducer(before, { type: 'toggle-all-in-group', kommuner: [oslo], bydelsByKommune })).toEqual(state(['03']))
  })
})

describe('bydeler', () => {
  test('toggle one', () => {
    const toggle = (s: SelectionState) => reducer(s, { type: 'toggle-bydel', bydelnummer: '030101' })
    expect(toggle(initialState)).toEqual(state([], [], ['030101']))
    expect(toggle(state([], [], ['030101']))).toEqual(state([]))
  })

  test('toggle all in a kommune completes a partial selection, then clears it', () => {
    const toggle = (s: SelectionState) =>
      reducer(s, { type: 'toggle-all-bydeler-in-kommune', bydeler: osloBydeler })
    const all = toggle(state([], [], ['030102', '460101']))
    expect(all).toEqual(state([], [], ['030101', '030102', '460101']))
    expect(toggle(all)).toEqual(state([], [], ['460101']))
  })

  test('clear', () => {
    const before = state(['03'], ['0301'], ['030101'])
    expect(reducer(before, { type: 'clear-all-bydeler' })).toEqual(state(['03'], ['0301']))
  })
})

test('actions leave the previous state alone', () => {
  const before = state(['03', '32'], ['0301', '3203'], ['030101'])
  const copy = structuredClone(before)
  reducer(before, { type: 'toggle-group', groupId: '03', kommuner: [oslo], bydelsByKommune })
  reducer(before, { type: 'toggle-all-in-group', kommuner: [oslo], bydelsByKommune })
  reducer(before, { type: 'toggle-all-bydeler-in-kommune', bydeler: osloBydeler })
  expect(before).toEqual(copy)
})

test('each inndeling keeps its own selection', () => {
  const toggle = (groupId: string) => ({ type: 'toggle-group' as const, groupId, kommuner: [], bydelsByKommune })
  let states = scopedReducer({}, { scope: 'fylker', action: toggle('03') })
  states = scopedReducer(states, { scope: 'politidistrikter', action: toggle('p01') })
  expect(states).toEqual({ fylker: state(['03']), politidistrikter: state(['p01']) })
})
