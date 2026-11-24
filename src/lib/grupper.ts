/**
 * SSB's standard order of the fylker (roughly south-east to north), which is
 * how most Norwegian tables and lists present them — rather than by number.
 * Unknown numbers go last, by number.
 */
const FYLKE_REKKEFOLGE = ['03', '32', '31', '33', '34', '39', '40', '42', '11', '46', '15', '50', '18', '55', '56']
export function fylkeRekkefolge(fylkesnummer: string): number {
  const index = FYLKE_REKKEFOLGE.indexOf(fylkesnummer)
  return index === -1 ? 100 + Number(fylkesnummer) : index
}
