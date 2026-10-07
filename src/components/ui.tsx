import type { ReactNode } from 'react'

/** Numbered section heading in the sidebar: «01  Inndeling». */
export function SectionHeader({
  number,
  title,
  titleFor,
  aside,
}: {
  number?: string
  title: ReactNode
  /** Makes the title a <label> for this input id. */
  titleFor?: string
  aside?: ReactNode
}) {
  const Title = titleFor ? 'label' : 'h2'
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="flex min-w-0 items-baseline gap-2.5">
        {number && <span className="font-mono text-xs font-medium text-accent">{number}</span>}
        <Title htmlFor={titleFor} className="truncate text-[15px] font-semibold text-ink">
          {title}
        </Title>
      </div>
      {aside}
    </div>
  )
}

/** Text-style button for secondary actions such as «Velg alle». */
export function TextButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="shrink-0 cursor-pointer rounded-md px-1 py-1.5 font-medium text-accent hover:text-accent-hover"
    >
      {children}
    </button>
  )
}

/**
 * Two or more mutually exclusive options as a segmented control, built from
 * real buttons with aria-pressed (spec: «Segmentkontroller med aria-pressed»).
 */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  size = 'md',
  stretch = true,
}: {
  label: string
  options: readonly (readonly [T, string])[]
  value: T
  onChange: (value: T) => void
  size?: 'sm' | 'md'
  stretch?: boolean
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={`${stretch ? 'grid' : 'inline-grid shrink-0'} gap-0.5 rounded-field bg-seg p-[3px]`}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map(([optionValue, optionLabel]) => {
        const active = optionValue === value
        return (
          <button
            key={optionValue}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(optionValue)}
            className={`${size === 'sm' ? 'h-[34px] px-2.5 text-[13px]' : 'h-9 px-3'} cursor-pointer truncate rounded-lg ${
              active ? 'bg-surface font-semibold text-ink shadow-[0_1px_2px_rgba(21,32,30,0.12)]' : 'text-ink-2 hover:text-ink'
            }`}
          >
            {optionLabel}
          </button>
        )
      })}
    </div>
  )
}

/** Pill-shaped toggle (spec: chips 32 px; selected = filled accent with ×). */
export function Chip({
  selected,
  onClick,
  children,
  title,
  large = false,
}: {
  selected: boolean
  onClick: () => void
  children: ReactNode
  title?: string
  large?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      title={title}
      onClick={onClick}
      className={`${large ? 'h-[34px]' : 'h-8'} inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border pr-2.5 pl-3 whitespace-nowrap ${
        selected
          ? 'border-accent bg-accent font-medium text-on-accent hover:bg-accent-hover'
          : 'border-input bg-surface text-ink-2 hover:border-accent hover:text-ink'
      }`}
    >
      {children}
      {selected && (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      )}
    </button>
  )
}

/** Square icon button on a floating card (zoom, menu, close). Minimum 44 px. */
export function IconButton({
  label,
  onClick,
  children,
  className = '',
}: {
  label: string
  onClick: () => void
  children: ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={`flex h-11 w-11 cursor-pointer items-center justify-center bg-surface text-ink hover:bg-seg ${className}`}
    >
      {children}
    </button>
  )
}

export function DownloadIcon({ className = 'h-[18px] w-[18px]' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 4v12M6 11l6 6 6-6M5 20h14" />
    </svg>
  )
}

export function Spinner() {
  return <span className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-line border-t-accent" aria-hidden="true" />
}

/** The app mark: a stylised map outline. */
export function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" className="shrink-0 text-accent" aria-hidden="true">
      <path d="M5 25 L9 6 L17 4 L25 11 L22 22 L13 26 Z" />
      <path d="M9 6 L14 15 L22 22 M14 15 L5 25" strokeOpacity="0.45" />
    </svg>
  )
}
