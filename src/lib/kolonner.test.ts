import { expect, test } from 'vitest'
import { DISTRIKT_KIND_LIST, DISTRIKT_KINDS } from './distrikter'
import { kolonneInfo } from './kolonner'

test.each(DISTRIKT_KIND_LIST)('the code of %s is only called SSB’s when it is', (kind) => {
  const { idField, kilde } = DISTRIKT_KINDS[kind]
  const info = kolonneInfo(idField)!
  expect(info.kilde?.navn).toBe(kilde)
  expect(info.beskrivelse.includes('SSB')).toBe(kilde.startsWith('SSB'))
})
