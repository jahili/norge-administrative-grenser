/** Map overlay, top left: the selection, its size and «Zoom til utvalg». */
export function SelectionCard({
  tittel,
  detaljer,
  onZoom,
  kanZoome,
}: {
  tittel: string
  detaljer: string
  onZoom: () => void
  kanZoome: boolean
}) {
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2.5 rounded-card border border-line bg-surface py-2 pr-2 pl-3.5 shadow-float">
      <span className="font-semibold text-ink">{tittel}</span>
      <span aria-live="polite" className="text-[13px] text-muted">
        {detaljer}
      </span>
      <button
        type="button"
        onClick={onZoom}
        disabled={!kanZoome}
        className="h-8 cursor-pointer rounded-lg border border-line bg-surface px-3 text-[13px] text-ink-2 hover:bg-seg disabled:cursor-not-allowed disabled:opacity-50"
      >
        Zoom til utvalg
      </button>
    </div>
  )
}
