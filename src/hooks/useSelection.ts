import { useMemo, useReducer } from 'react'
import type { BydelProperties, FylkeProperties, KommuneProperties } from '../lib/types'

interface SelectionState {
  selectedFylker: Set<string>
  selectedKommuner: Set<string>
  selectedBydeler: Set<string>
}

type SelectionAction =
  | { type: 'toggle-fylke'; fylkesnummer: string; kommuner: KommuneProperties[]; bydelsByKommune: Map<string, BydelProperties[]> }
  | { type: 'toggle-all-fylker'; allFylkesnummer: string[] }
  | { type: 'toggle-kommune'; kommunenummer: string; bydeler: BydelProperties[] }
  | { type: 'toggle-all-in-fylke'; kommuner: KommuneProperties[]; bydelsByKommune: Map<string, BydelProperties[]> }
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
    case 'toggle-fylke': {
      const selectedFylker = withToggled(state.selectedFylker, action.fylkesnummer)
      // Deselecting a fylke removes its kommuner and their bydeler.
      if (selectedFylker.has(action.fylkesnummer)) {
        return { ...state, selectedFylker }
      }
      const selectedKommuner = new Set(state.selectedKommuner)
      let selectedBydeler = state.selectedBydeler
      for (const kommune of action.kommuner) {
        selectedKommuner.delete(kommune.kommunenummer)
        const bydeler = action.bydelsByKommune.get(kommune.kommunenummer) ?? []
        selectedBydeler = withoutBydelerFor(selectedBydeler, bydeler)
      }
      return { selectedFylker, selectedKommuner, selectedBydeler }
    }
    case 'toggle-all-fylker': {
      const allSelected = action.allFylkesnummer.every((nr) => state.selectedFylker.has(nr))
      if (allSelected) {
        return { selectedFylker: new Set(), selectedKommuner: new Set(), selectedBydeler: new Set() }
      }
      return { ...state, selectedFylker: new Set(action.allFylkesnummer) }
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
    case 'toggle-all-in-fylke': {
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
  selectedFylker: new Set(),
  selectedKommuner: new Set(),
  selectedBydeler: new Set(),
}

export function useSelection(
  fylker: FylkeProperties[],
  kommunerByFylke: Map<string, KommuneProperties[]>,
  bydelsByKommune: Map<string, BydelProperties[]>,
) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const allFylkesnummer = useMemo(() => fylker.map((f) => f.fylkesnummer), [fylker])

  const allFylkerSelected = allFylkesnummer.length > 0 && allFylkesnummer.every((nr) => state.selectedFylker.has(nr))
  const someFylkerSelected = state.selectedFylker.size > 0

  return {
    selectedFylker: state.selectedFylker,
    selectedKommuner: state.selectedKommuner,
    selectedBydeler: state.selectedBydeler,
    allFylkerSelected,
    someFylkerSelected,
    toggleFylke: (fylkesnummer: string) =>
      dispatch({ type: 'toggle-fylke', fylkesnummer, kommuner: kommunerByFylke.get(fylkesnummer) ?? [], bydelsByKommune }),
    toggleAllFylker: () => dispatch({ type: 'toggle-all-fylker', allFylkesnummer }),
    toggleKommune: (kommunenummer: string) =>
      dispatch({ type: 'toggle-kommune', kommunenummer, bydeler: bydelsByKommune.get(kommunenummer) ?? [] }),
    toggleAllInFylke: (fylkesnummer: string) =>
      dispatch({
        type: 'toggle-all-in-fylke',
        kommuner: kommunerByFylke.get(fylkesnummer) ?? [],
        bydelsByKommune,
      }),
    toggleBydel: (bydelnummer: string) => dispatch({ type: 'toggle-bydel', bydelnummer }),
    toggleAllBydelerInKommune: (kommunenummer: string) =>
      dispatch({ type: 'toggle-all-bydeler-in-kommune', bydeler: bydelsByKommune.get(kommunenummer) ?? [] }),
    clearAllBydeler: () => dispatch({ type: 'clear-all-bydeler' }),
  }
}

export type SelectionApi = ReturnType<typeof useSelection>
