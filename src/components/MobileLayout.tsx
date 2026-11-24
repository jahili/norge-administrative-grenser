import { useState } from 'react'
import type { ReactNode } from 'react'

export type MobileTab = 'utvalg' | 'geometri' | 'kolonner'

/** Mobile: map on top, controls in a bottom sheet with tabs, fixed download button. */
export function MobileLayout({
  map,
  tab,
  onTabChange,
  utvalg,
  geometri,
  kolonner,
  downloadButton,
}: {
  map: ReactNode
  tab: MobileTab
  onTabChange: (tab: MobileTab) => void
  utvalg: ReactNode
  geometri: ReactNode
  kolonner: ReactNode
  downloadButton: ReactNode
}) {
  const [expanded, setExpanded] = useState(false)
  const tabs: [MobileTab, string][] = [
    ['utvalg', 'Utvalg'],
    ['geometri', 'Geometri'],
    ['kolonner', 'Kolonner'],
  ]
  return (
    <div className="relative h-dvh overflow-hidden bg-sea">
      <div className="absolute inset-x-0 top-0 h-[47dvh]">{map}</div>
      <section
        aria-label="Kontroller"
        className={`absolute inset-x-0 bottom-0 z-[1100] flex flex-col rounded-t-[20px] bg-surface shadow-[0_-6px_24px_rgba(21,32,30,0.15)] transition-[top] duration-200 ${
          expanded ? 'top-[10dvh]' : 'top-[43dvh]'
        }`}
      >
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Vis mer av kartet' : 'Vis mer av panelet'}
          className="flex h-6 w-full shrink-0 cursor-pointer items-center justify-center"
        >
          <span className="h-1 w-10 rounded-full bg-input" />
        </button>
        <div role="tablist" aria-label="Panel" className="flex shrink-0 gap-1.5 border-b border-line px-4">
          {tabs.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              id={`fane-${value}`}
              aria-selected={tab === value}
              aria-controls={`panel-${value}`}
              onClick={() => onTabChange(value)}
              className={`h-11 cursor-pointer border-b-2 px-3 ${
                tab === value ? 'border-accent font-semibold text-ink' : 'border-transparent text-muted'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`fane-${tab}`}
          className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-3.5"
        >
          {tab === 'utvalg' ? utvalg : tab === 'geometri' ? geometri : kolonner}
        </div>
        <div className="shrink-0 border-t border-line bg-surface-2 px-4 pt-3 pb-[max(22px,env(safe-area-inset-bottom))]">
          {downloadButton}
        </div>
      </section>
    </div>
  )
}
