import { useMemo, useReducer } from 'react'
import type { BydelProperties, KommuneGruppe, KommuneProperties } from '../lib/types'

/**
 * Selection state for one inndeling: groups of kommuner (fylker, politidistrikter
 * or 110-distrikter), then kommuner within the selected groups, then bydeler
 * within the selected kommuner.
 */
interface SelectionState {
  selectedGroups: Set<string>
  selectedKommuner: Set<string>
  selectedBydeler: Set<string>
}

type SelectionAction =
  | { type: 'toggle-group'; groupId: string; kommuner: KommuneProperties[]; bydelsByKommune: Map<string, BydelProperties[]> }
  | { type: 'toggle-all-groups'; allGroupIds: string[] }
  | { type: 'toggle-kommune'; kommunenummer: string; bydeler: BydelProperties[] }
  | { type: 'toggle-all-in-group'; kommuner: KommuneProperties[]; bydelsByKommune: Map<string, BydelProperties[]> }
  | { type: 'toggle-bydel'; bydelnummer: string }
  | { type: 'toggle-all-bydeler-in-kommune'; bydeler: BydelProperties[] }
  | { type: 'clear-all-bydeler' }

function withToggled(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

function withoutBydelerFor(selectedBydeler: Set<string>, bydeler: BydelProperties[]): Set<string> {
  const next = new Set(selectedBydeler)
  for (const b of bydeler) next.delete(b.bydelnummer)
  return next
}

function reducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'toggle-group': {
      const selectedGroups = withToggled(state.selectedGroups, action.groupId)
      // Deselecting a group removes its kommuner and their bydeler.
      if (selectedGroups.has(action.groupId)) {
        return { ...state, selectedGroups }
      }
      const selectedKommuner = new Set(state.selectedKommuner)
      let selectedBydeler = state.selectedBydeler
      for (const kommune of action.kommuner) {
        selectedKommuner.delete(kommune.kommunenummer)
        const bydeler = action.bydelsByKommune.get(kommune.kommunenummer) ?? []
        selectedBydeler = withoutBydelerFor(selectedBydeler, bydeler)
      }
      return { selectedGroups, selectedKommuner, selectedBydeler }
    }
    case 'toggle-all-groups': {
      const allSelected = action.allGroupIds.every((id) => state.selectedGroups.has(id))
      if (allSelected) {
        return { selectedGroups: new Set(), selectedKommuner: new Set(), selectedBydeler: new Set() }
      }
      return { ...state, selectedGroups: new Set(action.allGroupIds) }
    }
    case 'toggle-kommune': {
      const selectedKommuner = withToggled(state.selectedKommuner, action.kommunenummer)
      // Deselecting a kommune also removes its bydeler.
      if (selectedKommuner.has(action.kommunenummer)) {
        return { ...state, selectedKommuner }
      }
      const selectedBydeler = withoutBydelerFor(state.selectedBydeler, action.bydeler)
      return { ...state, selectedKommuner, selectedBydeler }
    }
    case 'toggle-all-in-group': {
      const ids = action.kommuner.map((k) => k.kommunenummer)
      const allSelected = ids.every((id) => state.selectedKommuner.has(id))
      const selectedKommuner = new Set(state.selectedKommuner)
      let selectedBydeler = state.selectedBydeler
      for (const kommune of action.kommuner) {
        if (allSelected) {
          selectedKommuner.delete(kommune.kommunenummer)
          const bydeler = action.bydelsByKommune.get(kommune.kommunenummer) ?? []
          selectedBydeler = withoutBydelerFor(selectedBydeler, bydeler)
        } else {
          selectedKommuner.add(kommune.kommunenummer)
        }
      }
      return { ...state, selectedKommuner, selectedBydeler }
    }
    case 'toggle-bydel': {
      return { ...state, selectedBydeler: withToggled(state.selectedBydeler, action.bydelnummer) }
    }
    case 'toggle-all-bydeler-in-kommune': {
      const ids = action.bydeler.map((b) => b.bydelnummer)
      const allSelected = ids.every((id) => state.selectedBydeler.has(id))
      const selectedBydeler = new Set(state.selectedBydeler)
      for (const id of ids) {
        if (allSelected) selectedBydeler.delete(id)
        else selectedBydeler.add(id)
      }
      return { ...state, selectedBydeler }
    }
    case 'clear-all-bydeler': {
      return { ...state, selectedBydeler: new Set() }
    }
  }
}

const initialState: SelectionState = {
  selectedGroups: new Set(),
  selectedKommuner: new Set(),
  selectedBydeler: new Set(),
}

export function useSelection(
  groups: KommuneGruppe[],
  kommunerByGroup: Map<string, KommuneProperties[]>,
  bydelsByKommune: Map<string, BydelProperties[]>,
) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const allGroupIds = useMemo(() => groups.map((g) => g.id), [groups])

  const allGroupsSelected = allGroupIds.length > 0 && allGroupIds.every((id) => state.selectedGroups.has(id))
  const someGroupsSelected = state.selectedGroups.size > 0

  return {
    selectedGroups: state.selectedGroups,
    selectedKommuner: state.selectedKommuner,
    selectedBydeler: state.selectedBydeler,
    allGroupsSelected,
    someGroupsSelected,
    toggleGroup: (groupId: string) =>
      dispatch({ type: 'toggle-group', groupId, kommuner: kommunerByGroup.get(groupId) ?? [], bydelsByKommune }),
    toggleAllGroups: () => dispatch({ type: 'toggle-all-groups', allGroupIds }),
    toggleKommune: (kommunenummer: string) =>
      dispatch({ type: 'toggle-kommune', kommunenummer, bydeler: bydelsByKommune.get(kommunenummer) ?? [] }),
    toggleAllInGroup: (groupId: string) =>
      dispatch({
        type: 'toggle-all-in-group',
        kommuner: kommunerByGroup.get(groupId) ?? [],
        bydelsByKommune,
      }),
    toggleBydel: (bydelnummer: string) => dispatch({ type: 'toggle-bydel', bydelnummer }),
    toggleAllBydelerInKommune: (kommunenummer: string) =>
      dispatch({ type: 'toggle-all-bydeler-in-kommune', bydeler: bydelsByKommune.get(kommunenummer) ?? [] }),
    clearAllBydeler: () => dispatch({ type: 'clear-all-bydeler' }),
  }
}

export type SelectionApi = ReturnType<typeof useSelection>
