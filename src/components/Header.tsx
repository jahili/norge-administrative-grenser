import { useEffect, useRef } from 'react'
import type { Theme } from '../hooks/useTheme'
import { Logo } from './ui'

export const GITHUB_URL = 'https://github.com/jahili/norge-administrative-grenser'
export const KARTDATA_AAR = 2026

interface HeaderProps {
  theme: Theme
  onToggleTheme: () => void
  onOpenOm: () => void
  onOpenKolonner: () => void
}

/** Desktop header, 60 px: mark, title, links and theme toggle. */
export function Header({ theme, onToggleTheme, onOpenOm, onOpenKolonner }: HeaderProps) {
  const link = 'cursor-pointer rounded-lg px-3 py-2 font-medium text-ink-2 no-underline hover:bg-seg hover:text-ink'
  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between gap-4 border-b border-line bg-surface px-5">
      <div className="flex min-w-0 items-center gap-3">
        <Logo />
        <div className="flex min-w-0 flex-col">
          <h1 className="text-base font-bold tracking-[-0.01em] text-ink">Norske grenser</h1>
          <span className="truncate text-xs text-muted">
            Fylker, kommuner og bydeler som GeoJSON og TopoJSON · Kartdata {KARTDATA_AAR}
          </span>
        </div>
      </div>
      <nav aria-label="Hovedmeny" className="flex shrink-0 items-center gap-1.5">
        <button type="button" onClick={onOpenOm} className={link}>
          Om dataene
        </button>
        <button type="button" onClick={onOpenKolonner} className={link}>
          Kolonner
        </button>
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className={link}>
          GitHub
        </a>
        <ThemeButton theme={theme} onToggle={onToggleTheme} />
      </nav>
    </header>
  )
}

export function ThemeButton({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const isDark = theme === 'dark'
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={isDark ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'}
      title={isDark ? 'Lyst tema' : 'Mørkt tema'}
      className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-field border border-line bg-surface text-ink-2 hover:bg-seg hover:text-ink"
    >
      {isDark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M22 12h-2M4 12H2M19 5l-1.5 1.5M6.5 17.5 5 19M19 19l-1.5-1.5M6.5 6.5 5 5" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
        </svg>
      )}
    </button>
  )
}

/** «Om dataene»: the introduction and sources that used to fill the page. */
export function OmDataene({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // A click on the backdrop (the dialog element itself) closes it.
        if (e.target === e.currentTarget) onClose()
      }}
      aria-labelledby="om-tittel"
      className="m-auto w-[min(640px,calc(100vw-32px))] rounded-card border border-line bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <h2 id="om-tittel" className="text-lg font-semibold">
            Om dataene
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Lukk"
            className="-mt-2 -mr-2 flex h-11 w-11 cursor-pointer items-center justify-center rounded-field text-ink-2 hover:bg-seg"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <p className="text-ink-2">
          Her kan du finne og laste ned kartdata for norske administrative grenser. Velg mellom fylker, kommuner og bydeler,
          eller grupper kommunene etter politidistrikter, valgdistrikter, helseregioner, bo- og arbeidsmarkedsregioner og en
          rekke andre inndelinger – helt ned til grunnkretser og delområder – og last ned grensene i GeoJSON- eller TopoJSON-format.
        </p>
        <p className="text-ink-2">
          Appen gjør det enkelt å hente ut kartgrunnlag til analyser, visualiseringer og webkart – enten du trenger hele
          landet, utvalgte områder eller bestemte administrative nivåer. Alt skjer lokalt i nettleseren; ingen data sendes
          til en server. Koordinatsystemet er WGS84 (EPSG:4326).
        </p>
        <div>
          <h3 className="mb-1.5 font-semibold">Kilder</h3>
          <ul className="flex list-disc flex-col gap-1 pl-5 text-ink-2">
            <li>
              Fylkes-, kommune- og grunnkretsgrenser:{' '}
              <a href="https://kartverket.no" target="_blank" rel="noopener noreferrer">
                Kartverket
              </a>{' '}
              (kartdata {KARTDATA_AAR}).
            </li>
            <li>
              Politidistrikter, valgdistrikter og de øvrige inndelingene, delområder og navneendringer:{' '}
              <a href="https://www.ssb.no/klass/" target="_blank" rel="noopener noreferrer">
                SSBs klassifikasjoner
              </a>
              .
            </li>
            <li>
              110-distrikter:{' '}
              <a href="https://kartkatalog.geonorge.no/metadata/c4436a5f-1e22-461a-8209-786f7052acb5" target="_blank" rel="noopener noreferrer">
                DSB
              </a>
              .
            </li>
            <li>
              Bo- og arbeidsmarkedsregioner:{' '}
              <a
                href="https://www.regjeringen.no/no/dokumenter/inndeling-av-kommuner-i-bo--og-arbeidsmarkedsregioner/id2662614/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Transportøkonomisk institutt (TØI)
              </a>{' '}
              på oppdrag fra Kommunal- og moderniseringsdepartementet (2019), 159 regioner for kommunestrukturen 2020 – kodet
              om til kommunestrukturen 2024, med Haram i Ålesund-regionen.
            </li>
            <li>
              Bydeler for Bergen, Fredrikstad, Kristiansand, Oslo, Stavanger og Trondheim (merket med{' '}
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" aria-label="prikk" /> i
              kommunelisten): Kartverket, Oslo kommune og SSB.
            </li>
            <li>
              Bakgrunnskart:{' '}
              <a href="https://carto.com/attributions" target="_blank" rel="noopener noreferrer">
                CARTO
              </a>{' '}
              og OpenStreetMap-bidragsytere.
            </li>
          </ul>
        </div>
        <p className="text-xs text-muted">
          Kildekode og dokumentasjon av datapipelinen ligger på{' '}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          .
        </p>
      </div>
    </dialog>
  )
}
