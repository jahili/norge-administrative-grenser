import { useMemo, useReducer } from 'react'
import type { FylkeProperties, KommuneProperties } from '../lib/types'

interface SelectionState {
  selectedFylker: Set<string>
  selectedKommuner: Set<string>
}

type SelectionAction =
  | { type: 'toggle-fylke'; fylkesnummer: string; kommuner: KommuneProperties[] }
  | { type: 'toggle-all-fylker'; allFylkesnummer: string[] }
  | { type: 'toggle-kommune'; kommunenummer: string }
  | { type: 'toggle-all-in-fylke'; kommuner: KommuneProperties[] }

function withToggled(set: Set<string>, id: string): Set<string> {
  const next = new Set(set)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  return next
}

function reducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case 'toggle-fylke': {
      const selectedFylker = withToggled(state.selectedFylker, action.fylkesnummer)
      // Deselecting a fylke also removes its kommuner from the export selection.
      if (selectedFylker.has(action.fylkesnummer)) {
        return { ...state, selectedFylker }
      }
      const selectedKommuner = new Set(state.selectedKommuner)
      for (const kommune of action.kommuner) selectedKommuner.delete(kommune.kommunenummer)
      return { selectedFylker, selectedKommuner }
    }
    case 'toggle-all-fylker': {
      const allSelected = action.allFylkesnummer.every((nr) => state.selectedFylker.has(nr))
      if (allSelected) {
        return { selectedFylker: new Set(), selectedKommuner: new Set() }
      }
      return { ...state, selectedFylker: new Set(action.allFylkesnummer) }
    }
    case 'toggle-kommune': {
      return { ...state, selectedKommuner: withToggled(state.selectedKommuner, action.kommunenummer) }
    }
    case 'toggle-all-in-fylke': {
      const ids = action.kommuner.map((k) => k.kommunenummer)
      const allSelected = ids.every((id) => state.selectedKommuner.has(id))
      const selectedKommuner = new Set(state.selectedKommuner)
      for (const id of ids) {
        if (allSelected) selectedKommuner.delete(id)
        else selectedKommuner.add(id)
      }
      return { ...state, selectedKommuner }
    }
  }
}

const initialState: SelectionState = {
  selectedFylker: new Set(),
  selectedKommuner: new Set(),
}

export function useSelection(fylker: FylkeProperties[], kommunerByFylke: Map<string, KommuneProperties[]>) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const allFylkesnummer = useMemo(() => fylker.map((f) => f.fylkesnummer), [fylker])

  const allFylkerSelected = allFylkesnummer.length > 0 && allFylkesnummer.every((nr) => state.selectedFylker.has(nr))
  const someFylkerSelected = state.selectedFylker.size > 0

  return {
    selectedFylker: state.selectedFylker,
    selectedKommuner: state.selectedKommuner,
    allFylkerSelected,
    someFylkerSelected,
    toggleFylke: (fylkesnummer: string) =>
      dispatch({ type: 'toggle-fylke', fylkesnummer, kommuner: kommunerByFylke.get(fylkesnummer) ?? [] }),
    toggleAllFylker: () => dispatch({ type: 'toggle-all-fylker', allFylkesnummer }),
    toggleKommune: (kommunenummer: string) => dispatch({ type: 'toggle-kommune', kommunenummer }),
    toggleAllInFylke: (fylkesnummer: string) =>
      dispatch({ type: 'toggle-all-in-fylke', kommuner: kommunerByFylke.get(fylkesnummer) ?? [] }),
  }
}

export type SelectionApi = ReturnType<typeof useSelection>
