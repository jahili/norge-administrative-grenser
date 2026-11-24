import { expect, test } from 'vitest'
import { utvalgDetaljer, utvalgTittel } from './format'

test('the map card names at most two groups', () => {
  expect(utvalgTittel([])).toBe('Ingen utvalg ennå')
  expect(utvalgTittel(['Oslo'])).toBe('Oslo')
  expect(utvalgTittel(['Oslo', 'Agder'])).toBe('Oslo og Agder')
  expect(utvalgTittel(['Oslo', 'Agder', 'Troms', 'Finnmark'])).toBe('Oslo, Agder +2')
})

test('the map card says what the download contains', () => {
  expect(utvalgDetaljer('kommuner', 0, 31)).toBe('Klikk i kartet eller velg i listen')
  expect(utvalgDetaljer('kommuner', 1, 31)).toBe('1 kommune · 31 kolonner')
  expect(utvalgDetaljer('delomrader', 2, 9)).toBe('2 delområder · 9 kolonner')
})
